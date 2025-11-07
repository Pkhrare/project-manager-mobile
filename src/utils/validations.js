// validations.js - Mobile App Version

/**
 * Validation utilities and constants for the mobile app
 */

// A fixed list of the 18 standard activities.
export const DEFAULT_ACTIVITIES = [
  "Preparation And Assistance with Required Corporate Actions",
  "Completion Of Requirement and Application Process",
  "Customized, State-Specific Policies and Procedures",
  "Client Admission Packet",
  "Website, Domain, And Email Setup",
  "Marketing And Advertising Materials",
  "Operational Training",
  "Compliance And Regulatory Support",
  "Marketing And Client Acquisition Strategies",
  "Accreditation Support",
  "Quality Assurance Programs",
  "Certificate Of Needs Development",
  "Medicaid Provider Enrollment",
  "MCO Enrollment & Credentialing",
  "Medicare Enrollment & Certification",
  "Other Insurance Payers",
  "Private Pay & Referral Network",
  "Accreditation Support Services (ACHC, Chap, Joint Commission)"
];

export const dropdownFields = {
  Action_type: [
    'Review and Complete',
    'Complete Application',
    'Enroll Provider',
    'Schedule Meeting',
    'Submit Documents',
    'Follow Up',
    'Approve',
    'Reject',
    'Request Information',
    'Update Records'
  ],
  States: [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO',
    'CT', 'DE', 'FL', 'GA', 'HI', 'ID',
    'IL', 'IN', 'IA', 'KS', 'KY', 'LA',
    'ME', 'MD', 'MA', 'MI', 'MN',
    'MS', 'MO', 'MT', 'NE', 'NV',
    'NH', 'NJ', 'NM', 'NY',
    'NC', 'ND', 'OH', 'OK', 'OR',
    'PA', 'RI', 'SC', 'SD',
    'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
    'WV', 'WI', 'WY'
  ],
  'Project Type': [
    'Licensing & Medicaid',
    'Licensing Only',
    'Technical (Other)',
    'Market Research',
    'Medicaid Enrollment Only',
    'Policy & Procedure Manual',
    'PA',
    'Home Health'
  ],
  'Assigned Consultant': [
    'Michael Tarr',
    'Sheikh Konneh',
    'Varlee Massalay',
    'Amara M Kamara',
    'Michelle Gottlieb',
    'Fatu Kaba'
  ],
  'Supervising Consultant': [
    'Amara M Kamara',
    'Michelle Gottlieb'
  ],
  'Project Manager': [
    'Dave Logan',
    'Fatima Koroma',
    'System Notification',
    'Waiver Group'
  ]
};

export const taskStatusOptions = [
  'Not Started',
  'In Progress',
  'Completed',
  'On Hold',
  'Cancelled'
];

export const projectStatusOptions = [
  'Not Started',
  'Preparatory Stage with Consultant',
  'In Progress',
  'Under Review',
  'Completed',
  'On Hold',
  'Cancelled'
];

// Helper function to validate email
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function to validate required fields
export const validateRequiredFields = (data, requiredFields) => {
  const errors = [];
  
  requiredFields.forEach(field => {
    if (!data[field] || data[field].toString().trim() === '') {
      errors.push(`${field} is required`);
    }
  });
  
  return errors;
};

// Helper function to format date for display
export const formatDate = (dateString) => {
  if (!dateString) return 'No date';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return 'Invalid date';
  }
};

// Helper function to get status color
export const getStatusColor = (status) => {
  const statusColors = {
    'Not Started': { bg: '#F3F4F6', text: '#6B7280' },
    'In Progress': { bg: '#FEF3C7', text: '#D97706' },
    'Completed': { bg: '#D1FAE5', text: '#059669' },
    'On Hold': { bg: '#FEE2E2', text: '#DC2626' },
    'Cancelled': { bg: '#F3F4F6', text: '#6B7280' },
    'Under Review': { bg: '#E0E7FF', text: '#3730A3' }
  };
  
  return statusColors[status] || { bg: '#F3F4F6', text: '#6B7280' };
};
