export const ENGINEERS = [
  {
    id: 'ENG-101',
    name: 'Alex Wong',
    role: 'Senior Staff Electrical Engineer',
    specialty: 'High Voltage & Power Distribution',
    phone: '+1 (555) 234-5678',
    email: 'alex@apex.com',
    status: 'Busy',
    activeJobs: 2,
    hourlyRate: 120
  },
  {
    id: 'ENG-102',
    name: 'Carlos Mendoza',
    role: 'Staff HVAC Specialist',
    specialty: 'Industrial Chillers & Cleanrooms',
    phone: '+1 (555) 345-6789',
    email: 'carlos@apex.com',
    status: 'Available',
    activeJobs: 0,
    hourlyRate: 110
  },
  {
    id: 'ENG-103',
    name: 'Priya Sharma',
    role: 'Staff Automation Systems Engineer',
    specialty: 'Siemens PLC & Robotics Control',
    phone: '+1 (555) 456-7890',
    email: 'priya@apex.com',
    status: 'On Site',
    activeJobs: 1,
    hourlyRate: 135
  },
  {
    id: 'ENG-104',
    name: 'Marcus Vance',
    role: 'Field Service Staff Mechanic',
    specialty: 'Pumps, Compressors & Hydraulics',
    phone: '+1 (555) 567-8901',
    email: 'marcus@apex.com',
    status: 'Available',
    activeJobs: 0,
    hourlyRate: 95
  }
];

export const INITIAL_ACCOUNTS = [
  {
    id: 'ACC-ADM-01',
    name: 'Sarah Jenkins (Operations Mgr)',
    email: 'admin@apex.com',
    phone: '+1 (555) 000-1111',
    password: 'admin123',
    role: 'admin', // DATABASE ROLE ROW: admin
    customerName: 'Apex Operations Admin',
    createdAt: '2026-01-01'
  },
  {
    id: 'ACC-STAFF-101',
    name: 'Alex Wong',
    email: 'alex@apex.com',
    phone: '+1 (555) 234-5678',
    password: 'staff123',
    role: 'staff', // DATABASE ROLE ROW: staff (engineer)
    engineerId: 'ENG-101',
    createdAt: '2026-01-01'
  },
  {
    id: 'ACC-STAFF-102',
    name: 'Carlos Mendoza',
    email: 'carlos@apex.com',
    phone: '+1 (555) 345-6789',
    password: 'staff123',
    role: 'staff', // DATABASE ROLE ROW: staff (engineer)
    engineerId: 'ENG-102',
    createdAt: '2026-01-01'
  },
  {
    id: 'ACC-CUST-01',
    name: 'David Miller (Plant Dir)',
    email: 'dmiller@acmesemi.com',
    phone: '+1 (555) 901-2345',
    password: 'cust123',
    role: 'customer', // DATABASE ROLE ROW: customer
    customerName: 'Acme Semiconductor Manufacturing',
    createdByAdmin: true,
    createdAt: '2026-02-15'
  },
  {
    id: 'ACC-CUST-02',
    name: 'Elena Rostova',
    email: 'elena@biopharm.io',
    phone: '+1 (555) 812-3456',
    password: 'cust123',
    role: 'customer', // DATABASE ROLE ROW: customer
    customerName: 'BioPharm Innovations Lab',
    createdByAdmin: true,
    createdAt: '2026-03-10'
  },
  {
    id: 'ACC-CUST-03',
    name: 'Markus Vance',
    email: 'markus@logixhub.com',
    phone: '+1 (555) 723-4567',
    password: 'cust123',
    role: 'customer', // DATABASE ROLE ROW: customer
    customerName: 'LogiX Logistics Hub',
    createdByAdmin: true,
    createdAt: '2026-04-20'
  }
];

export const INITIAL_REQUESTS = [
  {
    id: 'REQ-2026-001',
    title: 'Main Transformer Voltage Surge Fault',
    category: 'Electrical',
    priority: 'Emergency',
    customerName: 'Acme Semiconductor Manufacturing',
    contactPerson: 'David Miller (Plant Director)',
    phone: '+1 (555) 901-2345',
    email: 'dmiller@acmesemi.com',
    location: 'Building B, Cleanroom Facility, Sector 4',
    description: 'Main 480V distribution panel tripped during peak production shift. Emergency shutdown triggered. Production line halted. Urgent engineer response needed.',
    dateSubmitted: '2026-08-07 09:15 AM',
    status: 'In Progress',
    assignedEngineerId: 'ENG-101',
    assignedEngineerName: 'Alex Wong',
    
    workLog: [
      {
        timestamp: '2026-08-07 09:30 AM',
        author: 'Sarah Jenkins (Admin)',
        role: 'Admin',
        text: 'Assigned Senior Staff Engineer Alex Wong to Emergency Request REQ-2026-001.'
      },
      {
        timestamp: '2026-08-07 09:45 AM',
        author: 'Alex Wong',
        role: 'Staff Engineer',
        text: 'En route with high voltage diagnostic kit and replacement 400A fuses.'
      },
      {
        timestamp: '2026-08-07 10:15 AM',
        author: 'Alex Wong',
        role: 'Staff Engineer',
        text: 'Arrived at site. Isolated main circuit breaker. Identified secondary surge arrester failure due to external grid spike.'
      }
    ],

    fieldReport: {
      hoursSpent: 3.5,
      diagnosis: 'Blown secondary 400A high-speed fuses and damaged surge protection unit.',
      partsUsed: [
        { description: 'Industrial 400A Semiconductor Fuse (Pack of 3)', qty: 1, unitPrice: 240 },
        { description: 'Heavy-Duty MOV Surge Protection Module', qty: 1, unitPrice: 380 }
      ],
      completedAt: null
    },

    billing: {
      baseCalloutFee: 150,
      hourlyRate: 120,
      totalHours: 3.5,
      laborTotal: 420,
      partsTotal: 620,
      subtotal: 1190,
      tax: 95.20,
      grandTotal: 1285.20,
      billingStatus: 'Unbilled',
      invoiceNumber: 'INV-2026-0801',
      invoiceDate: null
    }
  },
  {
    id: 'REQ-2026-002',
    title: 'Chiller Unit #3 Freon Pressure Alarm',
    category: 'HVAC',
    priority: 'High',
    customerName: 'BioPharm Innovations Lab',
    contactPerson: 'Elena Rostova',
    phone: '+1 (555) 812-3456',
    email: 'elena@biopharm.io',
    location: 'Lab Annex 2, Temperature Cold Room',
    description: 'Cold storage unit #3 reporting pressure drop warning. Temperature currently 4°C above safety limit.',
    dateSubmitted: '2026-08-06 02:30 PM',
    status: 'Completed',
    assignedEngineerId: 'ENG-102',
    assignedEngineerName: 'Carlos Mendoza',

    workLog: [
      {
        timestamp: '2026-08-06 02:40 PM',
        author: 'Admin Office',
        role: 'Admin',
        text: 'Assigned Carlos Mendoza.'
      },
      {
        timestamp: '2026-08-06 03:15 PM',
        author: 'Carlos Mendoza',
        role: 'Staff Engineer',
        text: 'Replaced cracked copper fitting seal. Recharged system with R-410A refrigerant and leak-tested.'
      },
      {
        timestamp: '2026-08-06 05:00 PM',
        author: 'Carlos Mendoza',
        role: 'Staff Engineer',
        text: 'Temperature stabilized at 2°C target. System verified. Job completed.'
      }
    ],

    fieldReport: {
      hoursSpent: 2.5,
      diagnosis: 'Micro-crack in expansion valve copper flange causing slow refrigerant bleed.',
      partsUsed: [
        { description: 'R-410A Refrigerant Canister (10kg)', qty: 1, unitPrice: 180 },
        { description: 'Brass Flange Fitting & O-Ring Seal Kit', qty: 2, unitPrice: 35 }
      ],
      completedAt: '2026-08-06 05:00 PM'
    },

    billing: {
      baseCalloutFee: 150,
      hourlyRate: 110,
      totalHours: 2.5,
      laborTotal: 275,
      partsTotal: 250,
      subtotal: 675,
      tax: 54.00,
      grandTotal: 729.00,
      billingStatus: 'Invoice Sent',
      invoiceNumber: 'INV-2026-0789',
      invoiceDate: '2026-08-06 05:30 PM'
    }
  },
  {
    id: 'REQ-2026-003',
    title: 'Automated Conveyor Belt PLC Logic Sync Fault',
    category: 'Automation',
    priority: 'Medium',
    customerName: 'LogiX Logistics Hub',
    contactPerson: 'Markus Vance',
    phone: '+1 (555) 723-4567',
    email: 'markus@logixhub.com',
    location: 'Distribution Sorting Center, Bay 12',
    description: 'Sorting arm sensor timing misaligned. Occasional false jams on optical scanner.',
    dateSubmitted: '2026-08-07 08:00 AM',
    status: 'Pending',
    assignedEngineerId: '',
    assignedEngineerName: 'Unassigned',

    workLog: [],
    fieldReport: {
      hoursSpent: 0,
      diagnosis: '',
      partsUsed: [],
      completedAt: null
    },
    billing: {
      baseCalloutFee: 150,
      hourlyRate: 135,
      totalHours: 0,
      laborTotal: 0,
      partsTotal: 0,
      subtotal: 150,
      tax: 12,
      grandTotal: 162,
      billingStatus: 'Unbilled',
      invoiceNumber: '',
      invoiceDate: null
    }
  }
];
