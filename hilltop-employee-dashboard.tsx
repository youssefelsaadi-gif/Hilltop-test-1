import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Upload, AlertCircle, Users, Briefcase, AlertTriangle, Download } from 'lucide-react';

const HRDashboard = () => {
  const [employees, setEmployees] = useState([]);
  const [openPositions, setOpenPositions] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [employeeFileName, setEmployeeFileName] = useState('');
  const [openPosFileName, setOpenPosFileName] = useState('');

  const handlePrint = () => {
    console.log('Print button clicked!');
    alert('Print function called - checking if print dialog opens...');
    try {
      setTimeout(() => {
        console.log('Attempting to open print dialog...');
        window.print();
      }, 100);
    } catch (error) {
      console.error('Print error:', error);
      alert('Error: ' + error.message);
    }
  };

  const handleEmployeeFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setEmployeeFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        setEmployees(jsonData);
      } catch (error) {
        alert('Error reading employee file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleOpenPositionsUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setOpenPosFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        setOpenPositions(jsonData);
      } catch (error) {
        alert('Error reading open positions file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Smart property matching function
  const normalizePropertyName = (name) => {
    if (!name) return '';
    return name.toLowerCase()
      .replace(/^\d+-/, '') // Remove leading numbers and dash
      .replace(/[^a-z0-9]/g, '') // Remove special characters
      .trim();
  };

  const findMatchingProperty = (openPosLocation, employeeProperties) => {
    const normalizedOpen = normalizePropertyName(openPosLocation);
    
    for (const empProp of employeeProperties) {
      const normalizedEmp = normalizePropertyName(empProp);
      
      // Exact match
      if (normalizedEmp === normalizedOpen) {
        return empProp;
      }
      
      // Check if one contains the other (handles "Almaville" vs "Almaville Farms at Seven Oaks")
      if (normalizedEmp.includes(normalizedOpen) || normalizedOpen.includes(normalizedEmp)) {
        return empProp;
      }
    }
    return null;
  };

  // Data quality analysis
  const dataQualityCheck = useMemo(() => {
    if (employees.length === 0 || openPositions.length === 0) return null;

    const empPropsUnique = [...new Set(employees.map(e => e['Cost Center 1']))].filter(Boolean);
    const openLocations = [...new Set(openPositions.map(o => o['Location']))].filter(Boolean);

    const mismatches = [];
    const unmatchedOpenings = [];

    openLocations.forEach(loc => {
      // Find if there's a matching employee property using contains logic
      const matchedEmpProp = empPropsUnique.find(empProp => {
        const normEmp = normalizePropertyName(empProp);
        const normLoc = normalizePropertyName(loc);
        return normEmp === normLoc || normEmp.includes(normLoc) || normLoc.includes(normEmp);
      });

      if (matchedEmpProp && matchedEmpProp !== loc) {
        // Names are different but they match
        mismatches.push({ 
          openPosName: loc, 
          employeeName: matchedEmpProp,
          openingsCount: openPositions.filter(p => p['Location'] === loc).length
        });
      } else if (!matchedEmpProp) {
        // No match at all - this property has openings but no employees
        const openingsCount = openPositions.filter(p => p['Location'] === loc).length;
        unmatchedOpenings.push({ location: loc, count: openingsCount });
      }
    });

    return { mismatches, unmatchedOpenings, totalChecked: openLocations.length };
  }, [employees, openPositions]);

  // Use smart matching for property consolidation - NO DUPLICATES
  const allProperties = useMemo(() => {
    const empPropsUnique = [...new Set(employees.map(e => e['Cost Center 1']).filter(Boolean))];
    const openPropsUnique = [...new Set(openPositions.map(o => o['Location']).filter(Boolean))];
    
    // Start with employee properties as canonical names
    const masterList = [...empPropsUnique];
    
    // Only add open position locations that don't match any employee property using contains logic
    openPropsUnique.forEach(loc => {
      const hasMatch = empPropsUnique.some(empProp => {
        const normEmp = normalizePropertyName(empProp);
        const normLoc = normalizePropertyName(loc);
        return normEmp === normLoc || normEmp.includes(normLoc) || normLoc.includes(normEmp);
      });
      if (!hasMatch) {
        // This is a truly unmatched property (like a new property with no employees yet)
        masterList.push(loc);
      }
    });
    
    return masterList.sort();
  }, [employees, openPositions]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (selectedProperty === 'all') return true;
      
      const empProp = emp['Cost Center 1'];
      if (empProp === selectedProperty) return true;
      
      // Use contains matching for flexibility
      const normEmp = normalizePropertyName(empProp);
      const normSelected = normalizePropertyName(selectedProperty);
      return normEmp === normSelected || normEmp.includes(normSelected) || normSelected.includes(normEmp);
    }).filter(emp => {
      if (searchTerm === '') return true;
      const searchLower = searchTerm.toLowerCase();
      return emp['Preferred / First Name']?.toLowerCase().includes(searchLower) ||
        emp['Last Name']?.toLowerCase().includes(searchLower) ||
        emp['Position Title']?.toLowerCase().includes(searchLower);
    });
  }, [employees, selectedProperty, searchTerm]);

  const filteredOpenPositions = useMemo(() => {
    if (selectedProperty === 'all') return openPositions;
    
    return openPositions.filter(pos => {
      const posLoc = pos['Location'];
      
      // Direct match
      if (posLoc === selectedProperty) return true;
      
      // Use contains matching for flexibility
      const normPos = normalizePropertyName(posLoc);
      const normSelected = normalizePropertyName(selectedProperty);
      return normPos === normSelected || normPos.includes(normSelected) || normSelected.includes(normPos);
    });
  }, [openPositions, selectedProperty]);

  const comprehensiveStats = useMemo(() => {
    const empProperties = [...new Set(employees.map(e => e['Cost Center 1']))].filter(Boolean);
    
    const propertyData = empProperties.map(property => {
      const normalizedProp = normalizePropertyName(property);
      
      const currentStaff = employees.filter(e => e['Cost Center 1'] === property).length;
      
      // Find matching open positions using contains logic
      const openings = openPositions.filter(o => {
        const normalizedLoc = normalizePropertyName(o['Location']);
        return normalizedLoc === normalizedProp || 
               normalizedLoc.includes(normalizedProp) || 
               normalizedProp.includes(normalizedLoc);
      }).length;
      
      const totalNeeded = currentStaff + openings;
      const fillRate = totalNeeded > 0 ? ((currentStaff / totalNeeded) * 100).toFixed(1) : 100;
      
      return {
        property,
        currentStaff,
        openings,
        totalNeeded,
        fillRate: parseFloat(fillRate),
        vacancyRate: totalNeeded > 0 ? ((openings / totalNeeded) * 100).toFixed(1) : 0
      };
    }).sort((a, b) => b.openings - a.openings);

    // Add properties that only exist in open positions
    const unmatchedLocations = [...new Set(openPositions.map(o => o['Location']))].filter(loc => {
      return !empProperties.some(empProp => {
        const normEmp = normalizePropertyName(empProp);
        const normLoc = normalizePropertyName(loc);
        return normEmp === normLoc || normEmp.includes(normLoc) || normLoc.includes(normEmp);
      });
    });
    
    unmatchedLocations.forEach(loc => {
      const openings = openPositions.filter(o => o['Location'] === loc).length;
      propertyData.push({
        property: loc,
        currentStaff: 0,
        openings,
        totalNeeded: openings,
        fillRate: 0,
        vacancyRate: 100
      });
    });

    const positionVacancies = {};
    openPositions.forEach(pos => {
      const position = pos['Position'];
      positionVacancies[position] = (positionVacancies[position] || 0) + 1;
    });
    const hardestToFill = Object.entries(positionVacancies)
      .map(([position, count]) => ({ position, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const daysOpenData = openPositions.filter(p => p['Days Open']).map(p => p['Days Open']);
    const avgDaysOpen = daysOpenData.length > 0 ? 
      (daysOpenData.reduce((a, b) => a + b, 0) / daysOpenData.length).toFixed(1) : 0;
    const longOpenPositions = openPositions.filter(p => p['Days Open'] > 60).length;

    const statusCounts = {};
    openPositions.forEach(pos => {
      const status = pos['Status'] || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    const criticalProperties = propertyData
      .filter(p => p.openings >= 3 || parseFloat(p.vacancyRate) > 30)
      .slice(0, 5);

    const maintOpenings = openPositions.filter(p => p['Maint?'] === 'y').length;
    const officeOpenings = openPositions.length - maintOpenings;

    return {
      propertyData,
      hardestToFill,
      avgDaysOpen,
      longOpenPositions,
      statusData,
      criticalProperties,
      maintOpenings,
      officeOpenings
    };
  }, [employees, openPositions]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  if (employees.length === 0 || openPositions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-3xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">HR & Asset Management Dashboard</h1>
            <p className="text-gray-600 text-lg">Upload both files to get comprehensive staffing insights</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-blue-500 transition-colors">
              <div className="text-center">
                <Users className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Current Employees</h3>
                {employeeFileName ? (
                  <div className="text-green-600 text-sm mb-3">✓ {employeeFileName}</div>
                ) : (
                  <p className="text-gray-600 text-sm mb-3">Employee roster file</p>
                )}
                <label className="cursor-pointer">
                  <div className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors inline-block text-sm">
                    {employeeFileName ? 'Change File' : 'Upload File'}
                  </div>
                  <input type="file" accept=".xlsx,.xls" onChange={handleEmployeeFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-green-500 transition-colors">
              <div className="text-center">
                <Briefcase className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Open Positions</h3>
                {openPosFileName ? (
                  <div className="text-green-600 text-sm mb-3">✓ {openPosFileName}</div>
                ) : (
                  <p className="text-gray-600 text-sm mb-3">Vacant positions file</p>
                )}
                <label className="cursor-pointer">
                  <div className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors inline-block text-sm">
                    {openPosFileName ? 'Change File' : 'Upload File'}
                  </div>
                  <input type="file" accept=".xlsx,.xls" onChange={handleOpenPositionsUpload} className="hidden" />
                </label>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-3">✨ Enhanced Features:</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>• <strong>Smart Property Matching</strong> - Automatically links properties even with naming differences</li>
              <li>• <strong>Data Quality Alerts</strong> - Shows any mismatches or missing data</li>
              <li>• <strong>Complete Staffing View</strong> - See filled + vacant positions together</li>
              <li>• <strong>Fill Rate Tracking</strong> - Know exactly which properties need attention</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const selectedPropertyData = comprehensiveStats.propertyData.find(p => {
    if (p.property === selectedProperty) return true;
    const normProp = normalizePropertyName(p.property);
    const normSelected = normalizePropertyName(selectedProperty);
    return normProp === normSelected || normProp.includes(normSelected) || normSelected.includes(normProp);
  }) || { currentStaff: filteredEmployees.length, openings: filteredOpenPositions.length, fillRate: 0, vacancyRate: 0 };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 flex justify-between items-start" data-date={new Date().toLocaleString()}>
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">HR & Asset Management Dashboard</h1>
            <p className="text-gray-600">
              {employees.length} Employees • {openPositions.length} Open Positions • {allProperties.length} Properties
            </p>
          </div>
          <div className="flex gap-2 no-print">
            <div className="bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" />
              <span>Export PDF: Press <kbd className="bg-purple-800 px-2 py-0.5 rounded text-xs">Ctrl+P</kbd> or <kbd className="bg-purple-800 px-2 py-0.5 rounded text-xs">⌘+P</kbd></span>
            </div>
            <label className="cursor-pointer">
              <div className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 text-sm">
                <Users className="w-4 h-4" />
                Update Employees
              </div>
              <input type="file" accept=".xlsx,.xls" onChange={handleEmployeeFileUpload} className="hidden" />
            </label>
            <label className="cursor-pointer">
              <div className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 text-sm">
                <Briefcase className="w-4 h-4" />
                Update Openings
              </div>
              <input type="file" accept=".xlsx,.xls" onChange={handleOpenPositionsUpload} className="hidden" />
            </label>
          </div>
        </header>

        {/* Data Quality Check */}
        {dataQualityCheck && (dataQualityCheck.mismatches.length > 0 || dataQualityCheck.unmatchedOpenings.length > 0) && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6 rounded-r-lg">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Data Quality Issues Detected</h3>
                
                {dataQualityCheck.mismatches.length > 0 && (
                  <div className="mb-3">
                    <p className="text-yellow-800 text-sm font-medium mb-2">✅ Property Name Differences (Successfully Auto-Matched):</p>
                    <div className="bg-white rounded p-3 text-xs space-y-1">
                      {dataQualityCheck.mismatches.map((m, idx) => (
                        <div key={idx} className="flex items-center gap-2 flex-wrap">
                          <span className="text-gray-600">Open Positions File:</span>
                          <span className="font-mono bg-yellow-100 px-2 py-1 rounded">{m.openPosName}</span>
                          <span className="text-gray-400">→ matched to →</span>
                          <span className="font-mono bg-green-100 px-2 py-1 rounded">{m.employeeName}</span>
                          <span className="text-green-700 font-medium">✓ {m.openingsCount} opening(s) linked</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600 mt-2">These openings ARE showing in the dashboard under the correct property.</p>
                  </div>
                )}

                {dataQualityCheck.unmatchedOpenings.length > 0 && (
                  <div>
                    <p className="text-red-800 text-sm font-medium mb-2">⚠️ Properties with Openings but NO EMPLOYEES Found:</p>
                    <div className="bg-white rounded p-3 text-xs space-y-1">
                      {dataQualityCheck.unmatchedOpenings.map((u, idx) => (
                        <div key={idx} className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono bg-red-100 px-2 py-1 rounded text-red-800 font-medium">{u.location}</span>
                          <span className="text-gray-700">→ {u.count} opening(s)</span>
                          <span className="text-red-600 font-medium">← These openings ARE showing in dashboard but have 0 employees</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-red-700 mt-2 font-medium">
                      🔍 Possible causes: New property, typo in property name, or data entry error. Check the "Open Positions Detail" table below.
                    </p>
                  </div>
                )}
                
                <p className="text-yellow-700 text-xs mt-3 italic font-medium">
                  💡 All openings are displayed in the dashboard. Auto-matched properties show under the employee file's property name. Scroll down to "Open Positions Detail" to verify.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Critical Alerts */}
        {comprehensiveStats.criticalProperties.length > 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3" />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">🚨 Critical Staffing Alerts</h3>
                <p className="text-red-800 text-sm">
                  {comprehensiveStats.criticalProperties.length} properties need immediate attention: {' '}
                  {comprehensiveStats.criticalProperties.map(p => p.property.replace(/^\d+-/, '')).join(', ')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 no-print">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Property</label>
              <select
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Properties</option>
                {allProperties.map(prop => (
                  <option key={prop} value={prop}>{prop}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Employees</label>
              <input
                type="text"
                placeholder="Search by name or position..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Print-only header showing current view */}
        {selectedProperty !== 'all' && (
          <div className="hidden print:block bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <p className="text-blue-900 font-semibold">
              Viewing Property: {selectedProperty}
            </p>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-3xl font-bold text-blue-600">{selectedPropertyData.currentStaff}</div>
            <div className="text-gray-600 mt-1 text-sm">Current Staff</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-3xl font-bold text-red-600">{selectedPropertyData.openings}</div>
            <div className="text-gray-600 mt-1 text-sm">Open Positions</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-3xl font-bold text-green-600">
              {selectedProperty === 'all' ? 
                ((employees.length / (employees.length + openPositions.length)) * 100).toFixed(1) :
                selectedPropertyData.fillRate}%
            </div>
            <div className="text-gray-600 mt-1 text-sm">Fill Rate</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-3xl font-bold text-orange-600">{comprehensiveStats.avgDaysOpen}</div>
            <div className="text-gray-600 mt-1 text-sm">Avg Days Open</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-3xl font-bold text-purple-600">{comprehensiveStats.longOpenPositions}</div>
            <div className="text-gray-600 mt-1 text-sm">Open &gt; 60 Days</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Properties by Staffing Level</h2>
            <div className="overflow-y-auto max-h-80">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Staff</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Open</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Fill Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {comprehensiveStats.propertyData.map((prop, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-900">{prop.property.replace(/^\d+-/, '')}</td>
                      <td className="px-3 py-2 text-center text-gray-700">{prop.currentStaff}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          prop.openings === 0 ? 'bg-green-100 text-green-800' :
                          prop.openings <= 2 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {prop.openings}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`font-medium ${
                          prop.fillRate >= 90 ? 'text-green-600' :
                          prop.fillRate >= 75 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {prop.fillRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Hardest Positions to Fill</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comprehensiveStats.hardestToFill}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="position" angle={-45} textAnchor="end" height={120} fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Recruitment Pipeline Status</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={comprehensiveStats.statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {comprehensiveStats.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Maintenance vs Office Openings</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Maintenance', value: comprehensiveStats.maintOpenings },
                    { name: 'Office/Leasing', value: comprehensiveStats.officeOpenings }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill="#f59e0b" />
                  <Cell fill="#3b82f6" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Open Positions Detail */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Open Positions Detail
            <span className="text-gray-500 font-normal text-base ml-2">({filteredOpenPositions.length} openings)</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Open</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recruiter</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOpenPositions.map((pos, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{pos['Position']}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{pos['Location']}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        pos['Days Open'] <= 30 ? 'bg-green-100 text-green-800' :
                        pos['Days Open'] <= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {pos['Days Open']} days
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{pos['Status']}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{pos['Rec']}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        pos['Maint?'] === 'y' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {pos['Maint?'] === 'y' ? 'Maintenance' : 'Office'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Current Employees */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">
            Current Employees
            <span className="text-gray-500 font-normal text-base ml-2">({filteredEmployees.length} employees)</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pay Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hire Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supervisor</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map((emp, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {emp['Preferred / First Name']} {emp['Last Name']}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{emp['Position Title']}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        emp['Pay Type'] === 'Salary' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {emp['Pay Type']}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{emp['Hire Date']}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{emp['Cost Center 1']?.replace(/^\d+-/, '')}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{emp['Supervisor Name']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Print Styles */}
        <style>{`
          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            
            .no-print {
              display: none !important;
            }
            
            .print\\:block {
              display: block !important;
            }
            
            .hidden {
              display: none;
            }
            
            .bg-gray-50 {
              background-color: white !important;
            }
            
            /* Page breaks */
            .page-break-before {
              page-break-before: always;
            }
            
            /* Avoid breaking inside elements */
            .bg-white {
              page-break-inside: avoid;
            }
            
            /* Make charts smaller for print */
            .recharts-wrapper {
              max-height: 250px !important;
            }
            
            /* Ensure tables fit */
            table {
              font-size: 9px;
            }
            
            th, td {
              padding: 4px 8px !important;
            }
            
            /* Adjust spacing for print */
            .p-6 {
              padding: 0.75rem !important;
            }
            
            .mb-6 {
              margin-bottom: 0.75rem !important;
            }
            
            .gap-6 {
              gap: 0.5rem !important;
            }
            
            /* Header adjustments */
            h1 {
              font-size: 22px !important;
              margin-bottom: 0.5rem !important;
            }
            
            h2 {
              font-size: 14px !important;
              margin-bottom: 0.5rem !important;
            }
            
            /* Hide scrollbars */
            .overflow-y-auto,
            .overflow-x-auto {
              overflow: visible !important;
              max-height: none !important;
            }
            
            /* Make grids single column for better printing */
            .grid-cols-5,
            .grid-cols-4 {
              grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
            }
            
            /* Add date/time to print */
            header::after {
              content: "Generated: " attr(data-date);
              display: block;
              font-size: 10px;
              color: #666;
              margin-top: 0.25rem;
            }
          }
          
          @page {
            size: landscape;
            margin: 0.5cm;
          }
        `}</style>
      </div>
    </div>
  );
};

export default HRDashboard;