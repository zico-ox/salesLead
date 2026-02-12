import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Truck, FileText, ArrowLeft, Trash, GitBranch, Plus, X, BookOpen, Layers, User, TrendingUp, Tag, Lock } from 'lucide-react';
import { loadSalesFromFirebase, loadSubjectsFromFirebase, saveSubjectsToFirebase, deleteSaleFromFirebase, saveSalesToFirebase } from './firebase.config';

interface SaleEntry {
  id: number;
  userName: string;
  productName: string;
  category?: '+1' | '+2';
  subjects?: string[];
  amount: number;
  paymentStatus: 'Paid' | 'Pending';
  deliveryStatus: 'Delivered' | 'Pending';
  pdfAccessCount: number;
  lastAccessed?: string;
}

const Dashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authInput, setAuthInput] = useState('');

  const [sales, setSales] = useState<SaleEntry[]>([]);
  const [subjects, setSubjects] = useState<Record<string, { price1: number; price2: number; page1: number; page2: number; actualPrice1: number; actualPrice2: number }>>({});
  const [loading, setLoading] = useState(true);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isPageModalOpen, setIsPageModalOpen] = useState(false);
  const [isActualPriceModalOpen, setIsActualPriceModalOpen] = useState(false);
  const [isStudentPagesModalOpen, setIsStudentPagesModalOpen] = useState(false);
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [newSubjectPrice, setNewSubjectPrice] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchData = async () => {
      try {
        const [salesData, subjectsData] = await Promise.all([
          loadSalesFromFirebase(),
          loadSubjectsFromFirebase()
        ]);
        if (salesData) setSales(salesData);
        if (subjectsData) {
          const normalizedSubjects: Record<string, { price1: number; price2: number; page1: number; page2: number; actualPrice1: number; actualPrice2: number }> = {};
          Object.entries(subjectsData).forEach(([key, val]: [string, any]) => {
            normalizedSubjects[key] = {
              price1: val.price1 !== undefined ? val.price1 : (val.price || 30),
              price2: val.price2 !== undefined ? val.price2 : (val.price || 30),
              page1: val.page1 || 0,
              page2: val.page2 || 0,
              actualPrice1: val.actualPrice1 || 0,
              actualPrice2: val.actualPrice2 || 0
            };
          });
          setSubjects(normalizedSubjects);
        }
      } catch (error) {
        console.error("Error loading sales:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (authInput === '0000') {
      setIsAuthenticated(true);
    } else {
      alert('Incorrect ID');
      setAuthInput('');
    }
  };

  // --- Handlers ---
  const handleDeleteSale = async (id: number) => {
    if (!confirm('Delete this sale entry?')) return;
    const updated = sales.filter(s => s.id !== id);
    setSales(updated);
    await deleteSaleFromFirebase(id);
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newSubjectCode && newSubjectPrice) {
      const price = parseFloat(newSubjectPrice);
      const updatedSubjects = {
        ...subjects,
        [newSubjectCode.toUpperCase()]: { price1: price, price2: price, page1: 0, page2: 0, actualPrice1: 0, actualPrice2: 0 }
      };
      setSubjects(updatedSubjects);
      setNewSubjectCode('');
      setNewSubjectPrice('');
      await saveSubjectsToFirebase(updatedSubjects);
    }
  };

  const handleUpdateSubjectPrice = async (code: string, category: '+1' | '+2', newPrice: number) => {
    const subject = subjects[code];
    const updatedSubjects = {
      ...subjects,
      [code]: { 
        ...subject,
        [category === '+1' ? 'price1' : 'price2']: newPrice 
      }
    };
    setSubjects(updatedSubjects);

    // Update existing sales amounts if price changes
    const updatedSales = sales.map(sale => {
      if (sale.subjects && sale.subjects.some(s => s.split(' ')[1] === code)) {
        const newAmount = sale.subjects.reduce((acc, s) => {
          const parts = s.split(' ');
          const cat = parts[0] as '+1' | '+2';
          const subCode = parts[1];
          const subData = updatedSubjects[subCode];
          const price = (cat === '+1' ? subData?.price1 : subData?.price2) || 0;
          return acc + price;
        }, 0);
        return { ...sale, amount: newAmount };
      }
      return sale;
    });

    const changedSales = updatedSales.filter((s, i) => s.amount !== sales[i].amount);
    const promises: Promise<any>[] = [saveSubjectsToFirebase(updatedSubjects)];
    if (changedSales.length > 0) {
      setSales(updatedSales);
      promises.push(saveSalesToFirebase(updatedSales));
    }
    await Promise.all(promises);
  };

  const handleUpdateSubjectPage = async (code: string, category: '+1' | '+2', newPage: number) => {
    const subject = subjects[code];
    const updatedSubjects = {
      ...subjects,
      [code]: { 
        ...subject,
        [category === '+1' ? 'page1' : 'page2']: newPage 
      }
    };
    setSubjects(updatedSubjects);
    await saveSubjectsToFirebase(updatedSubjects);
  };

  const handleUpdateSubjectActualPrice = async (code: string, category: '+1' | '+2', newPrice: number) => {
    const subject = subjects[code];
    const updatedSubjects = {
      ...subjects,
      [code]: { 
        ...subject,
        [category === '+1' ? 'actualPrice1' : 'actualPrice2']: newPrice 
      }
    };
    setSubjects(updatedSubjects);
    await saveSubjectsToFirebase(updatedSubjects);
  };

  const handleDeleteSubject = async (code: string) => {
    if (confirm(`Delete subject ${code}?`)) {
      const newSubjects = { ...subjects };
      delete newSubjects[code];
      setSubjects(newSubjects);
      await saveSubjectsToFirebase(newSubjects);
    }
  };

  const totalRevenue = sales.reduce((acc, curr) => acc + curr.amount, 0);
  const pendingRevenue = sales.filter(s => s.paymentStatus === 'Pending').reduce((acc, curr) => acc + curr.amount, 0);
  const pendingDeliveries = sales.filter(s => s.deliveryStatus === 'Pending').length;
  const deliveredCount = sales.filter(s => s.deliveryStatus === 'Delivered').length;

  // Subject Counts
  const countsByCategory = sales.reduce((acc, sale) => {
    if (sale.subjects) {
      sale.subjects.forEach(s => {
        const parts = s.split(' ');
        if (parts.length >= 2) {
          const category = parts[0];
          const code = parts[1];
          if (category === '+1' || category === '+2') {
            if (!acc[category][code]) acc[category][code] = 0;
            acc[category][code]++;
          }
        }
      });
    }
    return acc;
  }, { '+1': {}, '+2': {} } as Record<string, Record<string, number>>);

  // Student Profit Analysis
  const studentStats = sales.map(sale => {
    let totalActualPrice = 0;
    if (sale.subjects) {
      sale.subjects.forEach(s => {
        const parts = s.split(' ');
        if (parts.length >= 2) {
          const category = parts[0];
          const code = parts[1];
          const subjectData = subjects[code];
          if (subjectData) {
             if (category === '+1') totalActualPrice += (subjectData.actualPrice1 || 0);
             if (category === '+2') totalActualPrice += (subjectData.actualPrice2 || 0);
          }
        }
      });
    }
    // Profit = Amount - Total Actual Price
    const profit = sale.amount - totalActualPrice;

    return {
      id: sale.id,
      name: sale.userName,
      totalActualPrice,
      amount: sale.amount,
      profit
    };
  });

  const totalProfit = studentStats.reduce((acc, curr) => acc + curr.profit, 0);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4 font-sans text-gray-800">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-sm w-full border border-gray-200">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-100 rounded-full text-blue-600">
              <Lock size={32} />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center mb-2 text-gray-900">Dashboard Access</h2>
          <p className="text-center text-gray-500 mb-6 text-sm">Enter access ID to continue</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-center text-xl tracking-widest"
              placeholder="ID"
              value={authInput}
              onChange={(e) => setAuthInput(e.target.value)}
              maxLength={4}
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all shadow-sm"
            >
              Access Dashboard
            </button>
            <Link to="/" className="block text-center text-gray-500 hover:text-blue-600 hover:underline text-sm mt-4">
              Back to Tracker
            </Link>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 font-sans text-gray-800">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <Link 
            to="/" 
            className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg shadow-sm hover:bg-blue-50 transition-all font-semibold border border-blue-100"
          >
            <ArrowLeft size={20} />
            Back to Tracker
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg h-fit flex items-center justify-center text-2xl font-bold">
                  ₹
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Revenue (Pending / Total)</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    <span className="text-emerald-600">₹{pendingRevenue}</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="text-blue-600">₹{totalRevenue}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg h-fit">
                  <Truck size={28} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Delivery (Pending / Delivered)</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    <span className="text-emerald-600">{pendingDeliveries}</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="text-blue-600">{deliveredCount}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-lg h-fit">
                  <FileText size={28} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Entries</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{sales.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-teal-100 text-teal-600 rounded-lg h-fit">
                  <TrendingUp size={28} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Profit</p>
                  <p className={`text-2xl font-bold mt-1 ${totalProfit >= 0 ? 'text-gray-900' : 'text-red-600'}`}>₹{totalProfit}</p>
                </div>
              </div>
            </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button 
                onClick={() => setIsDeleteModalOpen(true)}
                className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg shadow-sm transition-all flex items-center gap-2 font-semibold md:px-4"
              >
                <Trash size={18} /> <span className="hidden md:inline">Delete Entries</span>
              </button>
              <button 
                onClick={() => setIsSubjectModalOpen(true)}
                className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg shadow-sm transition-all flex items-center gap-2 font-semibold md:px-4"
              >
                <GitBranch size={18} /> <span className="hidden md:inline">Manage Subjects</span>
              </button>
              <button 
                onClick={() => setIsPageModalOpen(true)}
                className="p-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg shadow-sm transition-all flex items-center gap-2 font-semibold md:px-4"
              >
                <Layers size={18} /> <span className="hidden md:inline">Manage Pages</span>
              </button>
              <button 
                onClick={() => setIsActualPriceModalOpen(true)}
                className="p-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg shadow-sm transition-all flex items-center gap-2 font-semibold md:px-4"
              >
                <Tag size={18} /> <span className="hidden md:inline">Actual Prices</span>
              </button>
              <button 
                onClick={() => setIsStudentPagesModalOpen(true)}
                className="p-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg shadow-sm transition-all flex items-center gap-2 font-semibold md:px-4"
              >
                <FileText size={18} /> <span className="hidden md:inline">Student Pages</span>
              </button>
            </div>

            {/* Subject Sales Counts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* +1 Sales */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <BookOpen size={20} className="text-blue-600"/>
                  +1 Sales
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(countsByCategory['+1']).map(([code, count]) => (
                    <div key={code} className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex justify-between items-center">
                      <span className="font-bold text-gray-700">{code}</span>
                      <span className="bg-white text-blue-700 px-2 py-0.5 rounded-md font-bold shadow-sm text-sm">{count}</span>
                    </div>
                  ))}
                  {Object.keys(countsByCategory['+1']).length === 0 && (
                    <p className="text-gray-500 text-sm col-span-full">No +1 sales recorded.</p>
                  )}
                </div>
              </div>

              {/* +2 Sales */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <BookOpen size={20} className="text-purple-600"/>
                  +2 Sales
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(countsByCategory['+2']).map(([code, count]) => (
                    <div key={code} className="bg-purple-50 p-3 rounded-lg border border-purple-100 flex justify-between items-center">
                      <span className="font-bold text-gray-700">{code}</span>
                      <span className="bg-white text-purple-700 px-2 py-0.5 rounded-md font-bold shadow-sm text-sm">{count}</span>
                    </div>
                  ))}
                  {Object.keys(countsByCategory['+2']).length === 0 && (
                    <p className="text-gray-500 text-sm col-span-full">No +2 sales recorded.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Student Profit Analysis */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <User size={20} className="text-green-600"/>
                Student Profit Analysis
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                    <tr>
                      <th className="p-3">Student Name</th>
                      <th className="p-3 text-center">Total Actual Price</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {studentStats.map((stat) => (
                      <tr key={stat.id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">{stat.name}</td>
                        <td className="p-3 text-center text-gray-600">₹{stat.totalActualPrice}</td>
                        <td className="p-3 text-right text-gray-900">₹{stat.amount}</td>
                        <td className={`p-3 text-right font-bold ${stat.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          ₹{stat.profit}
                        </td>
                      </tr>
                    ))}
                    {studentStats.length === 0 && (
                       <tr><td colSpan={4} className="p-4 text-center text-gray-500">No sales data available.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- Delete Entries Modal --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <Trash size={24} className="text-red-600" />
                <h3 className="font-bold text-xl text-gray-900">Delete Entries</h3>
              </div>
              <button onClick={() => setIsDeleteModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {sales.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No entries to delete.</p>
              ) : (
                <div className="space-y-2">
                  {sales.map(sale => (
                    <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div>
                        <p className="font-bold text-gray-800">{sale.userName}</p>
                        <p className="text-xs text-gray-500">{sale.productName}</p>
                      </div>
                      <button onClick={() => handleDeleteSale(sale.id)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-full transition-colors">
                        <Trash size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0">
              <button onClick={() => setIsDeleteModalOpen(false)} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2.5 rounded-lg transition-all">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Subject Settings Modal --- */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <GitBranch size={24} className="text-purple-600" />
                <h3 className="font-bold text-xl text-gray-900">Manage Subjects</h3>
              </div>
              <button onClick={() => setIsSubjectModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <form onSubmit={handleAddSubject} className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-600 mb-1">Code</label>
                  <input type="text" placeholder="e.g. PHY" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase" value={newSubjectCode} onChange={e => setNewSubjectCode(e.target.value.toUpperCase())} required />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-bold text-gray-600 mb-1">Price (₹)</label>
                  <input type="number" placeholder="30" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={newSubjectPrice} onChange={e => setNewSubjectPrice(e.target.value)} required />
                </div>
                <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg h-[38px] w-[38px] flex items-center justify-center"><Plus size={20} /></button>
              </form>
              <div className="space-y-3">
                <h4 className="font-bold text-gray-700 text-sm border-b pb-2">Existing Subjects</h4>
                {Object.entries(subjects).map(([code, data]) => (
                  <div key={code} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <span className="font-bold text-gray-800 w-16">{code}</span>
                    <div className="flex items-center gap-4 flex-1 justify-end">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-gray-500">+1</span>
                        <span className="text-gray-500 text-sm">₹</span>
                        <input type="number" className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-right" value={data.price1} onChange={(e) => handleUpdateSubjectPrice(code, '+1', parseFloat(e.target.value))} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-gray-500">+2</span>
                        <span className="text-gray-500 text-sm">₹</span>
                        <input type="number" className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-right" value={data.price2} onChange={(e) => handleUpdateSubjectPrice(code, '+2', parseFloat(e.target.value))} />
                      </div>
                      <button onClick={() => handleDeleteSubject(code)} className="text-red-400 hover:text-red-600 p-1 ml-2"><X size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0">
              <button onClick={() => setIsSubjectModalOpen(false)} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2.5 rounded-lg transition-all">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Page Settings Modal --- */}
      {isPageModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <Layers size={24} className="text-orange-600" />
                <h3 className="font-bold text-xl text-gray-900">Manage Pages</h3>
              </div>
              <button onClick={() => setIsPageModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {Object.entries(subjects).map(([code, data]) => (
                <div key={code} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="font-bold text-gray-800 w-16">{code}</span>
                  <div className="flex items-center gap-4 flex-1 justify-end">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-gray-500">+1</span>
                      <input type="number" className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-right" value={data.page1 || 0} onChange={(e) => handleUpdateSubjectPage(code, '+1', parseInt(e.target.value) || 0)} placeholder="Pg" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-gray-500">+2</span>
                      <input type="number" className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-right" value={data.page2 || 0} onChange={(e) => handleUpdateSubjectPage(code, '+2', parseInt(e.target.value) || 0)} placeholder="Pg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0">
              <button onClick={() => setIsPageModalOpen(false)} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2.5 rounded-lg transition-all">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Actual Price Settings Modal --- */}
      {isActualPriceModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <Tag size={24} className="text-green-600" />
                <h3 className="font-bold text-xl text-gray-900">Manage Actual Prices</h3>
              </div>
              <button onClick={() => setIsActualPriceModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {Object.entries(subjects).map(([code, data]) => (
                <div key={code} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="font-bold text-gray-800 w-16">{code}</span>
                  <div className="flex items-center gap-4 flex-1 justify-end">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-gray-500">+1</span>
                      <span className="text-gray-500 text-sm">₹</span>
                      <input type="number" className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-right" value={data.actualPrice1 || 0} onChange={(e) => handleUpdateSubjectActualPrice(code, '+1', parseFloat(e.target.value) || 0)} placeholder="0" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-gray-500">+2</span>
                      <span className="text-gray-500 text-sm">₹</span>
                      <input type="number" className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-right" value={data.actualPrice2 || 0} onChange={(e) => handleUpdateSubjectActualPrice(code, '+2', parseFloat(e.target.value) || 0)} placeholder="0" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0">
              <button onClick={() => setIsActualPriceModalOpen(false)} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2.5 rounded-lg transition-all">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Student Pages Modal --- */}
      {isStudentPagesModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <FileText size={24} className="text-indigo-600" />
                <h3 className="font-bold text-xl text-gray-900">Student Pages</h3>
              </div>
              <button onClick={() => setIsStudentPagesModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-0 overflow-y-auto flex-1">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="p-4">Student Name</th>
                    <th className="p-4 text-right">Total Pages</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sales.map((sale) => {
                    let totalPages = 0;
                    if (sale.subjects) {
                      sale.subjects.forEach(s => {
                        const parts = s.split(' ');
                        if (parts.length >= 2) {
                          const category = parts[0];
                          const code = parts[1];
                          const subjectData = subjects[code];
                          if (subjectData) {
                             if (category === '+1') totalPages += (subjectData.page1 || 0);
                             if (category === '+2') totalPages += (subjectData.page2 || 0);
                          }
                        }
                      });
                    }
                    return (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="p-4 font-medium text-gray-900">{sale.userName}</td>
                        <td className="p-4 text-right text-gray-600 font-bold">{totalPages}</td>
                      </tr>
                    );
                  })}
                  {sales.length === 0 && (
                     <tr><td colSpan={2} className="p-4 text-center text-gray-500">No sales data available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0">
              <button onClick={() => setIsStudentPagesModalOpen(false)} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2.5 rounded-lg transition-all">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;