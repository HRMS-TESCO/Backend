// =============================================================
// Seed script — inserts the exact sample data shown in the UI
// Usage:  npm run seed
// =============================================================
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Employee = require('./models/Employee');
const Asset = require('./models/Asset');

const employees = [
  { employeeId: 'EMP-1001', name: 'Liam Foster',   role: 'Frontend Dev',    department: 'Engineering', avatarColor: '#DBEAFE' },
  { employeeId: 'EMP-1002', name: 'Zoe Martinez',  role: 'UX Designer',     department: 'Design',      avatarColor: '#EDE9FE' },
  { employeeId: 'EMP-1003', name: 'Ryan Patel',    role: 'Product Manager', department: 'Operations',  avatarColor: '#DCFCE7' },
  { employeeId: 'EMP-1004', name: 'Alex Thompson', role: 'Data Analyst',    department: 'Engineering', avatarColor: '#FEF3C7' },
  { employeeId: 'EMP-1005', name: 'Ethan Brown',   role: 'DevOps Eng',      department: 'Engineering', avatarColor: '#FEE2E2' },
];

const buildAssets = (empMap) => [
  // Liam Foster — EMP-1001
  { assetId: 'AST-001', name: 'MacBook Pro M2 14"', type: 'Laptop',   serialNo: 'MBP-2023-001', issuedDate: '2023-01-15', condition: 'Good', status: 'Assigned', employee: empMap['EMP-1001'] },
  { assetId: 'AST-002', name: 'Dell UltraSharp 27"', type: 'Monitor', serialNo: 'DEL-MON-027',  issuedDate: '2023-01-15', condition: 'Good', status: 'Assigned', employee: empMap['EMP-1001'] },
  { assetId: 'AST-003', name: 'Logitech MX Master 3', type: 'Mouse',  serialNo: 'LGT-MX3-003',  issuedDate: '2023-01-15', condition: 'Good', status: 'Assigned', employee: empMap['EMP-1001'] },
  { assetId: 'AST-004', name: 'Keychron K2',         type: 'Keyboard', serialNo: 'KEY-K2-004',  issuedDate: '2023-01-15', condition: 'Good', status: 'Assigned', employee: empMap['EMP-1001'] },
  { assetId: 'AST-005', name: 'Employee ID Card',    type: 'ID Card', serialNo: 'IDC-1001',     issuedDate: '2023-01-12', condition: 'Good', status: 'Assigned', employee: empMap['EMP-1001'] },

  // Zoe Martinez — EMP-1002
  { assetId: 'AST-006', name: 'MacBook Air M1',  type: 'Laptop',  serialNo: 'MBA-2023-006', issuedDate: '2023-02-10', condition: 'Fair', status: 'Assigned', employee: empMap['EMP-1002'] },
  { assetId: 'AST-007', name: 'Magic Mouse',     type: 'Mouse',   serialNo: 'APL-MM-007',   issuedDate: '2023-02-10', condition: 'Good', status: 'Assigned', employee: empMap['EMP-1002'] },
  { assetId: 'AST-008', name: 'Employee ID Card', type: 'ID Card', serialNo: 'IDC-1002',    issuedDate: '2023-02-05', condition: 'Good', status: 'Assigned', employee: empMap['EMP-1002'] },

  // Ryan Patel — EMP-1003
  { assetId: 'AST-009', name: 'Lenovo ThinkPad X1', type: 'Laptop',  serialNo: 'LNV-X1-009', issuedDate: '2023-03-20', condition: 'Good', status: 'Assigned', employee: empMap['EMP-1003'] },
  { assetId: 'AST-010', name: 'Employee ID Card',   type: 'ID Card', serialNo: 'IDC-1003',   issuedDate: '2023-03-15', condition: 'Poor', status: 'Assigned', employee: empMap['EMP-1003'] },

  // Alex Thompson — EMP-1004
  { assetId: 'AST-011', name: 'HP EliteBook 840', type: 'Laptop',  serialNo: 'HP-840-011',  issuedDate: '2023-04-01', condition: 'Good', status: 'Assigned', employee: empMap['EMP-1004'] },
  { assetId: 'AST-012', name: 'Logitech G502',    type: 'Mouse',   serialNo: 'LGT-G502-012', issuedDate: '2023-04-01', condition: 'Good', status: 'Assigned', employee: empMap['EMP-1004'] },
  { assetId: 'AST-013', name: 'Employee ID Card', type: 'ID Card', serialNo: 'IDC-1004',    issuedDate: '2023-03-30', condition: 'Good', status: 'Assigned', employee: empMap['EMP-1004'] },

  // Ethan Brown — EMP-1005
  { assetId: 'AST-014', name: 'Dell XPS 15',        type: 'Laptop',   serialNo: 'DLL-XPS-014', issuedDate: '2023-05-10', condition: 'Good', status: 'Assigned', employee: empMap['EMP-1005'] },
  { assetId: 'AST-015', name: 'LG 32" 4K Monitor',  type: 'Monitor',  serialNo: 'LG-4K-015',   issuedDate: '2023-05-10', condition: 'New',  status: 'Assigned', employee: empMap['EMP-1005'] },
  { assetId: 'AST-016', name: 'Anne Pro 2',         type: 'Keyboard', serialNo: 'ANP-2-016',   issuedDate: '2023-05-10', condition: 'Good', status: 'Assigned', employee: empMap['EMP-1005'] },
  { assetId: 'AST-017', name: 'Employee ID Card',   type: 'ID Card',  serialNo: 'IDC-1005',    issuedDate: '2023-05-08', condition: 'Good', status: 'Assigned', employee: empMap['EMP-1005'] },
];

const run = async () => {
  try {
    await connectDB();

    console.log('Clearing existing data...');
    await Promise.all([Employee.deleteMany({}), Asset.deleteMany({})]);

    console.log('Inserting employees...');
    const createdEmployees = await Employee.insertMany(employees);

    // employeeId -> ObjectId map
    const empMap = createdEmployees.reduce((acc, emp) => {
      acc[emp.employeeId] = emp._id;
      return acc;
    }, {});

    console.log('Inserting assets...');
    const assets = buildAssets(empMap);
    await Asset.insertMany(assets);

    console.log(`\nDone. Seeded ${createdEmployees.length} employees and ${assets.length} assets.\n`);
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
};

run();
