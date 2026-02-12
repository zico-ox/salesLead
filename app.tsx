import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  FileText,
  X,
  User,
  BookOpen,
  CreditCard,
  Truck,
  Filter,
  Trash,
  Pencil,
  LayoutDashboard
} from 'lucide-react';
import { loadSalesFromFirebase, addSaleToFirebase, updateSaleInFirebase, deleteSaleFromFirebase, saveSubjectsToFirebase, loadSubjectsFromFirebase, saveSalesToFirebase } from './firebase.config';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router';
import Dashboard from './Dashboard';

// --- Types ---
interface SaleEntry {
  id: number;
  userName: string;
  productName: string; // e.g., "+1 ACC"
  category?: '+1' | '+2';
  subjects?: string[];
  amount: number;
  paymentStatus: 'Paid' | 'Pending';
  deliveryStatus: 'Delivered' | 'Pending';
  pdfAccessCount: number; // Tracks how many times the PDF was opened/sent
  lastAccessed?: string;
}

const SalesTracker = () => {
  // --- State ---
  const [sales, setSales] = useState<SaleEntry[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPayment, setFilterPayment] = useState<'All' | 'Paid' | 'Pending'>('All');
  const [filterDelivery, setFilterDelivery] = useState<'All' | 'Delivered' | 'Pending'>('All');

  // Subject List with prices (now in state)
  const [subjects, setSubjects] = useState<Record<string, { price1: number; price2: number; page1: number; page2: number; actualPrice1: number; actualPrice2: number }>>({});

  // Form State
  // selectedSubjects holds objects so user can pick subjects under +1 and +2 simultaneously
  const [selectedSubjects, setSelectedSubjects] = useState<Array<{category: '+1' | '+2'; code: string}>>([]);
  
  const [formData, setFormData] = useState<Partial<SaleEntry>>({
    userName: '',
    productName: '',
    amount: 30.00,
    paymentStatus: 'Pending',
    deliveryStatus: 'Pending'
  });

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');

  // --- Firebase Integration ---
  // Removed unused 'syncStatus' state.

  useEffect(() => {
    // Load data from Firebase on component mount
    const loadData = async () => {
      try {
        const [firebaseSales, firebaseSubjects] = await Promise.all([
          loadSalesFromFirebase(),
          loadSubjectsFromFirebase()
        ]);

        console.log('Fetched sales from Firebase:', firebaseSales);
        console.log('Fetched subjects from Firebase:', firebaseSubjects);

        let loadedSubjects: Record<string, { price1: number; price2: number; page1: number; page2: number; actualPrice1: number; actualPrice2: number }> = {};
        if (firebaseSubjects) {
          const normalizedSubjects: Record<string, { price1: number; price2: number; page1: number; page2: number; actualPrice1: number; actualPrice2: number }> = {};
          Object.entries(firebaseSubjects).forEach(([key, val]: [string, any]) => {
            normalizedSubjects[key] = {
              price1: val.price1 !== undefined ? val.price1 : (val.price || 30),
              price2: val.price2 !== undefined ? val.price2 : (val.price || 30),
              page1: val.page1 || 0,
              page2: val.page2 || 0,
              actualPrice1: val.actualPrice1 || 0,
              actualPrice2: val.actualPrice2 || 0
            };
          });
          console.log('Normalized subjects:', normalizedSubjects);
          loadedSubjects = normalizedSubjects;
        }
        setSubjects(loadedSubjects);

        if (firebaseSales && Array.isArray(firebaseSales)) {
          // Recalculate amounts based on loaded subjects to ensure consistency
          const recalculatedSales = firebaseSales.map((sale: SaleEntry) => {
            if (sale.subjects && sale.subjects.length > 0) {
              const calculatedAmount = sale.subjects.reduce((acc, s) => {
                const parts = s.split(' ');
                if (parts.length < 2) return acc;
                const cat = parts[0] as '+1' | '+2';
                const subCode = parts[1];
                const subData = loadedSubjects[subCode];
                if (!subData) return acc;
                const price = (cat === '+1' ? subData.price1 : subData.price2) || 0;
                return acc + price;
              }, 0);

              // If calculated amount is valid and different, use it
              if (calculatedAmount > 0 && calculatedAmount !== sale.amount) {
                return { ...sale, amount: calculatedAmount };
              }
            }
            return sale;
          });
          
          setSales(recalculatedSales);
          console.log('Updated sales state with recalculation:', recalculatedSales);
        } else {
          // No data in Firebase yet — keep local state empty and don't auto-seed.
          setSales([]);
        }

      } catch (error) {
        console.error('Error loading from Firebase:', error);
      }
    };
    
    loadData();
  }, []);

  // --- Handlers ---

  // 1. Add or Edit Entry
  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.userName || selectedSubjects.length === 0) return;

    // Create single entry containing multiple selected subjects
    const subjectsList = [...selectedSubjects];
    // Use the amount from the form (allows manual override)
    const totalAmount = formData.amount || 0;

    const displayProduct = subjectsList.map(s => `${s.category} ${s.code}`).join(', ');
    const subjectStrings = subjectsList.map(s => `${s.category} ${s.code}`);

    setSyncStatus('syncing');

    if (editingId !== null) {
      // Update existing entry
      const updatedFields = {
        userName: formData.userName!,
        productName: displayProduct,
        subjects: subjectStrings,
        amount: totalAmount,
        paymentStatus: formData.paymentStatus as 'Paid' | 'Pending',
        deliveryStatus: formData.deliveryStatus as 'Delivered' | 'Pending',
      };

      setSales(sales.map(s => s.id === editingId ? { ...s, ...updatedFields } : s));

      try {
        const ok = await updateSaleInFirebase(editingId, updatedFields);
        if (ok) setSyncStatus('synced');
        else {
          setSyncStatus('idle');
          alert('Failed to update entry in Firebase.');
        }
      } catch (err) {
        setSyncStatus('idle');
        console.error('Error updating sale:', err);
      }
    } else {
      // Create new entry
      const newEntry: SaleEntry = {
        id: Date.now(),
        userName: formData.userName!,
        productName: displayProduct,
        subjects: subjectStrings,
        amount: totalAmount,
        paymentStatus: formData.paymentStatus as 'Paid' | 'Pending',
        deliveryStatus: formData.deliveryStatus as 'Delivered' | 'Pending',
        pdfAccessCount: 0,
      };

      setSales([newEntry, ...sales]);

      try {
        const ok = await addSaleToFirebase(newEntry);
        if (ok) setSyncStatus('synced');
        else {
          setSyncStatus('idle');
          alert('Failed to save new entry to Firebase.');
        }
      } catch (err) {
        setSyncStatus('idle');
        console.error('Error adding sale:', err);
      }
    }

    setTimeout(() => setSyncStatus('idle'), 2000);
    closeModal();
  };

  const handleEditClick = (sale: SaleEntry) => {
    setFormData({
      userName: sale.userName,
      amount: sale.amount,
      paymentStatus: sale.paymentStatus,
      deliveryStatus: sale.deliveryStatus
    });
    
    // Parse subjects back to selection format
    const parsedSubjects = (sale.subjects || []).map(s => {
      const parts = s.split(' ');
      return { category: parts[0] as '+1' | '+2', code: parts[1] };
    });
    
    setSelectedSubjects(parsedSubjects);
    setEditingId(sale.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({
      userName: '',
      amount: 30.00,
      paymentStatus: 'Pending',
      deliveryStatus: 'Pending'
    });
    setSelectedSubjects([]);
  };

  // 2. Update Payment Status
  const handleUpdatePaymentStatus = async (id: number, newStatus: 'Paid' | 'Pending') => {
    setSales(sales.map((sale: SaleEntry) => {
      if (sale.id === id) {
        return { ...sale, paymentStatus: newStatus };
      }
      return sale;
    }));
    
    // Sync to Firebase
    setSyncStatus('syncing');
    try {
      const ok = await updateSaleInFirebase(id, { paymentStatus: newStatus });
      if (!ok) {
        alert('Failed to update payment status in Firebase.');
        console.error('updateSaleInFirebase returned false for id', id);
      }
    } catch (err) {
      console.error('Error updating payment in Firebase:', err);
      alert('Error updating payment in Firebase. See console.');
    }
    setSyncStatus('synced');
    setTimeout(() => setSyncStatus('idle'), 2000);
  };

  // 3. Update Delivery Status
  const handleUpdateDeliveryStatus = async (id: number, newStatus: 'Delivered' | 'Pending') => {
    setSales(sales.map((sale: SaleEntry) => {
      if (sale.id === id) {
        return { ...sale, deliveryStatus: newStatus };
      }
      return sale;
    }));
    
    // Sync to Firebase
    setSyncStatus('syncing');
    try {
      const ok = await updateSaleInFirebase(id, { deliveryStatus: newStatus });
      if (!ok) {
        alert('Failed to update delivery status in Firebase.');
        console.error('updateSaleInFirebase returned false for id', id);
      }
    } catch (err) {
      console.error('Error updating delivery in Firebase:', err);
      alert('Error updating delivery in Firebase. See console.');
    }
    setSyncStatus('synced');
    setTimeout(() => setSyncStatus('idle'), 2000);
  };

  // 4. Delete Sale
  const handleDeleteSale = async (id: number) => {
    if (!confirm('Delete this sale entry?')) return;
    const updated = sales.filter(s => s.id !== id);
    setSales(updated);
    setSyncStatus('syncing');
    try {
      const ok = await deleteSaleFromFirebase(id);
      if (!ok) {
        alert('Failed to delete sale from Firebase.');
        console.error('deleteSaleFromFirebase returned false for id', id);
      }
    } catch (err) {
      console.error('Error deleting sale in Firebase:', err);
      alert('Error deleting sale in Firebase. See console.');
    }
    setSyncStatus('synced');
    setTimeout(() => setSyncStatus('idle'), 2000);
  };

  // Filter Logic
  const filteredSales = sales.filter((s: SaleEntry) => {
    const searchLower = searchTerm.toLowerCase();
    const productText = (s.productName || '').toLowerCase();
    const subjectsText = (s.subjects || []).join(' ').toLowerCase();
    const matchesSearch = s.userName.toLowerCase().includes(searchLower) ||
      productText.includes(searchLower) ||
      subjectsText.includes(searchLower);
    
    const matchesPayment = filterPayment === 'All' || s.paymentStatus === filterPayment;
    const matchesDelivery = filterDelivery === 'All' || s.deliveryStatus === filterDelivery;
    
    return matchesSearch && matchesPayment && matchesDelivery;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-6 font-sans text-gray-800">
      
      {/* --- Header & Stats --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-12 gap-6">
        <div className="flex items-center justify-between w-full md:w-auto gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Sale Entry</h1>
          <Link to="/dashboard">
            <button 
              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg shadow-sm transform hover:scale-105 transition-all"
              title="Dashboard"
            >
              <LayoutDashboard size={20} />
            </button>
          </Link>
        </div>
        <div className="flex gap-3 flex-wrap w-full md:w-auto">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all"
          >
            <Plus size={22} />
            New Sale
          </button>
        </div>
      </div>

      {/* --- Main Table --- */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 md:p-6 border-b border-gray-200 bg-gray-50 flex flex-col gap-4">
          {/* Search Bar */}
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text"
              placeholder="Search by name or product..."
              className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-3 items-center w-full">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 w-full md:w-auto">
              <Filter size={18} />
              Filters:
            </div>
            
            {/* Payment Status Filter */}
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value as any)}
              className="flex-1 md:flex-none px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none hover:border-gray-400 transition-colors"
            >
              <option value="All">All Payments</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
            </select>

            {/* Delivery Status Filter */}
            <select
              value={filterDelivery}
              onChange={(e) => setFilterDelivery(e.target.value as any)}
              className="flex-1 md:flex-none px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none hover:border-gray-400 transition-colors"
            >
              <option value="All">All Deliveries</option>
              <option value="Delivered">Delivered</option>
              <option value="Pending">Pending</option>
            </select>

            {/* Reset Filters */}
            {(filterPayment !== 'All' || filterDelivery !== 'All' || searchTerm) && (
              <button
                onClick={() => {
                  setFilterPayment('All');
                  setFilterDelivery('All');
                  setSearchTerm('');
                }}
                className="flex-1 md:flex-none px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium rounded-lg transition-colors text-sm"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
              <tr>
                <th className="p-4 text-left"><div className="flex items-center gap-2"><User size={18} /> Student Name</div></th>
                <th className="p-4 text-left"><div className="flex items-center gap-2"><BookOpen size={18} /> Product</div></th>
                
                <th className="p-4 text-left"><div className="flex items-center gap-2"><span className="text-lg font-bold">₹</span> Amount</div></th>
                <th className="p-4 text-left"><div className="flex items-center gap-2"><CreditCard size={18} /> Payment</div></th>
                <th className="p-4 text-left"><div className="flex items-center gap-2"><Truck size={18} /> Delivery</div></th>
                <th className="p-4 text-left"><div className="flex items-center gap-2">Actions</div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-blue-50 transition-colors duration-200">
                  <td className="p-4 font-semibold text-gray-900 align-middle">{sale.userName}</td>
                  <td className="p-4 text-gray-700 align-middle">
                    {sale.subjects && sale.subjects.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {sale.subjects.map((sub) => (
                          <div key={sub} className="px-3 py-1 border border-gray-200 rounded-md bg-white text-sm font-semibold">
                            {sub}
                          </div>
                        ))}
                      </div>
                    ) : (
                      sale.productName
                    )}
                  </td>
                  
                  <td className="p-4 font-bold text-gray-900 align-middle">₹{sale.amount.toFixed(2)}</td>
                  
                  {/* Payment Badge with Dropdown */}
                  <td className="p-4 align-middle">
                    <div className="relative mx-auto">
                      <select 
                        value={sale.paymentStatus}
                        onChange={(e) => handleUpdatePaymentStatus(sale.id, e.target.value as 'Paid' | 'Pending')}
                        className={`w-full text-sm font-semibold rounded-lg px-3 py-2 border cursor-pointer transition-all appearance-none text-center
                          ${sale.paymentStatus === 'Paid' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 
                            'bg-amber-50 border-amber-300 text-amber-700'}`}
                      >
                        <option value="Paid">Paid</option>
                        <option value="Pending">Pending</option>
                      </select>
                    </div>
                  </td>

                  {/* Delivery / Tracking Status with Dropdown */}
                  <td className="p-4 align-middle">
                    <div className="relative mx-auto">
                      <select 
                        value={sale.deliveryStatus}
                        onChange={(e) => handleUpdateDeliveryStatus(sale.id, e.target.value as 'Delivered' | 'Pending')}
                        className={`w-full text-sm font-semibold rounded-lg px-3 py-2 border cursor-pointer transition-all appearance-none text-center
                          ${sale.deliveryStatus === 'Delivered' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 
                            'bg-blue-50 border-blue-300 text-blue-700'}`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Delivered">Delivered</option>
                      </select>
                    </div>
                  </td>
                  <td className="p-4 align-middle text-right">
                    <button onClick={() => handleEditClick(sale)} className="text-blue-500 hover:text-blue-700 p-2 rounded-md bg-blue-50 hover:bg-blue-100 transition-colors mr-2">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDeleteSale(sale.id)} className="text-red-500 hover:text-red-700 p-2 rounded-md bg-red-50 hover:bg-red-100 transition-colors">
                      <Trash size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <p className="text-lg font-semibold text-gray-600">No entries found</p>
                    <p className="text-sm text-gray-500 mt-1">Add a new sale entry to get started</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-200">
          {filteredSales.map((sale) => (
            <div key={sale.id} className="p-4 bg-white space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{sale.userName}</h3>
                  {(!sale.subjects || sale.subjects.length === 0) && (
                    <p className="text-sm text-gray-500 mt-0.5">{sale.productName}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 text-lg">₹{sale.amount.toFixed(2)}</p>
                </div>
              </div>

              {sale.subjects && sale.subjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {sale.subjects.map((sub) => (
                    <span key={sub} className="px-2 py-0.5 border border-gray-200 rounded text-xs font-medium bg-gray-50 text-gray-600">
                      {sub}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="relative">
                  <select 
                    value={sale.paymentStatus}
                    onChange={(e) => handleUpdatePaymentStatus(sale.id, e.target.value as 'Paid' | 'Pending')}
                    className={`w-full text-xs font-bold rounded-lg px-2 py-2 border cursor-pointer transition-all appearance-none text-center
                      ${sale.paymentStatus === 'Paid' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 
                        'bg-amber-50 border-amber-300 text-amber-700'}`}
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
                <div className="relative">
                  <select 
                    value={sale.deliveryStatus}
                    onChange={(e) => handleUpdateDeliveryStatus(sale.id, e.target.value as 'Delivered' | 'Pending')}
                    className={`w-full text-xs font-bold rounded-lg px-2 py-2 border cursor-pointer transition-all appearance-none text-center
                      ${sale.deliveryStatus === 'Delivered' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 
                        'bg-blue-50 border-blue-300 text-blue-700'}`}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
          {filteredSales.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-lg font-semibold text-gray-600">No entries found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting filters or add a new sale</p>
            </div>
          )}
        </div>
      </div>

      {/* --- Add Entry Modal --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200">
            <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Plus size={24} className="text-blue-600" />
                <h3 className="font-bold text-xl text-gray-900">{editingId ? 'Edit Sale Entry' : 'New Sale Entry'}</h3>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEntry} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-2"><User size={18} /> Student Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  value={formData.userName}
                  onChange={e => setFormData({...formData, userName: e.target.value})}
                  placeholder="e.g. Alice Johnson"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-2"><BookOpen size={18} /> Category (pick subjects from both)</label>
                <div className="grid grid-cols-2 gap-4">
                  {/* +1 Subjects */}
                  <div className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="text-sm font-semibold text-gray-700 mb-2">+1</div>
                    <div className="space-y-2">
                      {Object.keys(subjects).map((subject) => {
                        const checked = selectedSubjects.some(s => s.category === '+1' && s.code === subject);
                        return (
                          <label key={`+1-${subject}`} className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                let next = [...selectedSubjects];
                                if (e.target.checked) {
                                  next.push({ category: '+1', code: subject });
                                } else {
                                  next = next.filter(s => !(s.category === '+1' && s.code === subject));
                                }
                                setSelectedSubjects(next);
                                const amountSum = next.reduce((acc, it) => {
                                  return acc + (it.category === '+1' ? (subjects[it.code]?.price1 || 0) : (subjects[it.code]?.price2 || 0));
                                }, 0);
                                setFormData({ ...formData, amount: amountSum });
                              }}
                              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="text-sm font-bold text-gray-800">{subject}</span>
                            <span className="text-xs text-gray-500 ml-auto flex items-center gap-1">
                              {subjects[subject].page1 > 0 && <span className="bg-gray-100 px-1 rounded text-gray-600">{subjects[subject].page1}p</span>}
                              <span>₹{subjects[subject].price1.toFixed(2)}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* +2 Subjects */}
                  <div className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="text-sm font-semibold text-gray-700 mb-2">+2</div>
                    <div className="space-y-2">
                      {Object.keys(subjects).map((subject) => {
                        const checked = selectedSubjects.some(s => s.category === '+2' && s.code === subject);
                        return (
                          <label key={`+2-${subject}`} className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                let next = [...selectedSubjects];
                                if (e.target.checked) {
                                  next.push({ category: '+2', code: subject });
                                } else {
                                  next = next.filter(s => !(s.category === '+2' && s.code === subject));
                                }
                                setSelectedSubjects(next);
                                const amountSum = next.reduce((acc, it) => {
                                  return acc + (it.category === '+1' ? (subjects[it.code]?.price1 || 0) : (subjects[it.code]?.price2 || 0));
                                }, 0);
                                setFormData({ ...formData, amount: amountSum });
                              }}
                              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="text-sm font-bold text-gray-800">{subject}</span>
                            <span className="text-xs text-gray-500 ml-auto flex items-center gap-1">
                              {subjects[subject].page2 > 0 && <span className="bg-gray-100 px-1 rounded text-gray-600">{subjects[subject].page2}p</span>}
                              <span>₹{subjects[subject].price2.toFixed(2)}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

                    <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-2"><span className="text-lg font-bold">₹</span> Amount</label>
                  <input 
                    type="number" 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-2"><CreditCard size={18} /> Payment</label>
                  <select 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none bg-white"
                    value={formData.paymentStatus}
                    onChange={e => setFormData({...formData, paymentStatus: e.target.value as any})}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-2"><Truck size={18} /> Delivery</label>
                  <select 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none bg-white"
                    value={formData.deliveryStatus}
                    onChange={e => setFormData({...formData, deliveryStatus: e.target.value as any})}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="submit" 
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition-all"
                >
                  {editingId ? 'Update Entry' : 'Save Entry'}
                </button>
                <button 
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2.5 rounded-lg transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export { SalesTracker };

const App = () => {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<SalesTracker />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
