// src/pages/History.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Download,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Calendar
} from 'lucide-react';

export default function HistoryPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedBox, setSelectedBox] = useState('all');

  const itemsPerPage = 7;

  useEffect(() => {
    const token = localStorage.getItem("token");

    const fetchLogs = () => {
      axios.get('http://192.168.1.10:5000/api/history/extended', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          setLogs(res.data);
          setLoading(false);
        })
        .catch(err => console.error("History Fetch Error:", err));
    };

    fetchLogs();

    const interval = setInterval(fetchLogs, 10000);

    return () => clearInterval(interval);
  }, []);

  // =========================
  // FILTER SEARCH, BOX, & DATE
  // =========================
  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.id?.toString().includes(search) ||
      log.box?.toString().includes(search) ||
      log.phase?.toLowerCase().includes(search.toLowerCase());

    const matchesBox = selectedBox === 'all' || log.box?.toString() === selectedBox;

    const logDate = log.time ? log.time.split(' ')[0] : '';
    const matchesDate = !selectedDate || logDate === selectedDate;

    return matchesSearch && matchesBox && matchesDate;
  });

  // Reset page ketika filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedDate, selectedBox]);

  // =========================
  // PAGINATION
  // =========================
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  const displayedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // =========================
  // DYNAMIC PAGE NUMBER
  // contoh:
  // page 1 => 1 2 3 4 5
  // page 2 => 2 3 4 5 6
  // =========================
  const getVisiblePages = () => {
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    let startPage = currentPage;
    let endPage = currentPage + (maxVisible - 1);

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = totalPages - (maxVisible - 1);
    }

    return Array.from(
      { length: endPage - startPage + 1 },
      (_, i) => startPage + i
    );
  };

  const visiblePages = getVisiblePages();

  // =========================
  // EXPORT CSV
  // =========================
  const downloadCSV = () => {
    if (logs.length === 0) return;

    const headers = [
      "ID",
      "Time",
      "Box",
      "Temp",
      "RH",
      "Media",
      "Phase",
      "Actuator"
    ];

    const csvContent = [
      headers.join(","),
      ...logs.map(r =>
        `${r.id},${r.time},${r.box},${r.temp},${r.rh},${r.media},${r.phase},${r.act}`
      )
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;'
    });

    const link = document.createElement("a");

    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);

    link.setAttribute(
      "download",
      `maggot_history_${new Date().toISOString().split('T')[0]}.csv`
    );

    link.style.visibility = 'hidden';

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);
  };

  // =========================
  // PHASE COLOR
  // =========================
  const getPhaseColor = (phase) => {
    switch (phase) {
      case 'Baby Larva':
        return 'bg-blue-50 text-blue-600 border-blue-100';

      case 'Adult Larva':
        return 'bg-emerald-50 text-emerald-600 border-emerald-100';

      case 'Prepupa':
        return 'bg-purple-50 text-purple-600 border-purple-100';

      default:
        return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="space-y-6">

      {/* TOOLBAR */}
      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">

          {/* SEARCH */}
          <div className="relative flex-1 min-w-[220px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />

            <input
              type="text"
              placeholder="Cari Box / Phase / ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* DATE */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded"
              >
                Clear
              </button>
            )}
          </div>

          {/* FILTER BOX */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
            <select
              value={selectedBox}
              onChange={(e) => setSelectedBox(e.target.value)}
              className="pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer appearance-none"
            >
              <option value="all">Semua Box</option>
              <option value="1">Box #1</option>
              <option value="2">Box #2</option>
              <option value="3">Box #3</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-400 w-0 h-0"></div>
          </div>
        </div>

        {/* EXPORT */}
        <div className="flex items-center gap-2 w-full xl:w-auto">

          <button
            onClick={downloadCSV}
            className="flex-1 xl:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100"
          >
            <Download size={18} />
            Export CSV
          </button>

          <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
            <FileSpreadsheet size={20} />
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

        {loading ? (
          <div className="py-20 text-center text-slate-400 font-bold animate-pulse">
            Memuat histori monitoring...
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">

              <table className="w-full text-sm text-left border-collapse">

                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Waktu (WIB)</th>
                    <th className="px-6 py-4 text-center">Box</th>
                    <th className="px-6 py-4">Suhu</th>
                    <th className="px-6 py-4">RH Udara</th>
                    <th className="px-6 py-4">RH Media</th>
                    <th className="px-6 py-4">Fase Dominan</th>
                    <th className="px-6 py-4">Aktuator Aktif</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {displayedLogs.map((log) => (

                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >

                      {/* WAKTU */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-slate-700 font-medium">
                            {log.time.split(' ')[1]}
                          </span>

                          <span className="text-[10px] text-slate-400 font-bold">
                            {log.time.split(' ')[0]}
                          </span>
                        </div>
                      </td>

                      {/* BOX */}
                      <td className="px-6 py-4 text-center">
                        <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-black text-xs">
                          #{log.box}
                        </span>
                      </td>

                      {/* TEMP */}
                      <td className="px-6 py-4">
                        <span className="text-slate-700 font-semibold">
                          {log.temp}°C
                        </span>
                      </td>

                      {/* RH */}
                      <td className="px-6 py-4">
                        <span className="text-slate-700 font-semibold">
                          {log.rh}%
                        </span>
                      </td>

                      {/* MEDIA */}
                      <td className="px-6 py-4">
                        <span className="text-slate-700 font-semibold">
                          {log.media}%
                        </span>
                      </td>

                      {/* PHASE */}
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full border text-[11px] font-black uppercase tracking-tight ${getPhaseColor(log.phase)}`}>
                          {log.phase}
                        </span>
                      </td>

                      {/* ACTUATOR */}
                      <td className="px-6 py-4">
                        {log.act !== '-' ? (
                          <span className="text-emerald-600 font-medium flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                            {log.act}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic">
                            Idle
                          </span>
                        )}
                      </td>

                      {/* STATUS */}
                      <td className="px-6 py-4">
                        <span className={`w-2.5 h-2.5 rounded-full inline-block ${log.status === 'warning'
                          ? 'bg-orange-400'
                          : 'bg-emerald-400'
                          }`}>
                        </span>
                      </td>

                    </tr>
                  ))}

                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">

              <p className="text-xs text-slate-500 font-medium">
                Menampilkan{" "}
                <span className="font-bold text-slate-700">
                  {filteredLogs.length > 0
                    ? (currentPage - 1) * itemsPerPage + 1
                    : 0}
                  {" - "}
                  {Math.min(
                    currentPage * itemsPerPage,
                    filteredLogs.length
                  )}
                </span>
                {" "}dari{" "}
                <span className="font-bold text-slate-700">
                  {filteredLogs.length}
                </span>
                {" "}entri
              </p>

              <div className="flex items-center gap-2">

                {/* PREV */}
                <button
                  onClick={() =>
                    setCurrentPage(Math.max(1, currentPage - 1))
                  }
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-200 rounded-lg bg-white text-slate-400 hover:text-slate-600 disabled:opacity-50"
                >
                  <ChevronLeft size={18} />
                </button>

                {/* PAGE NUMBERS */}
                <div className="flex items-center gap-1">

                  {visiblePages.map((page) => (

                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all
                        ${currentPage === page
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                      {page}
                    </button>

                  ))}

                </div>

                {/* NEXT */}
                <button
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-2 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ChevronRight size={18} />
                </button>

              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
