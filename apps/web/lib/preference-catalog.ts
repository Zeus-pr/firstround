import type { User } from 'firebase/auth';
import { apiUrl } from './api-url';

export type CatalogLists = {
  family: string[];
  location: string[];
  level: string[];
  keyword: string[];
  skill: string[];
  company: string[];
  industry: string[];
  employment: string[];
};

export const FALLBACK_CATALOG: CatalogLists = {
  family: [
    'Backend',
    'Frontend',
    'Full stack',
    'Mobile',
    'DevOps',
    'Data analyst',
    'Data science',
    'Product management',
    'Category',
    'Revenue',
    'GTM',
    'Merchandising',
    'Brand',
    'Marketing',
    'Sales',
    'Finance',
    'Operations',
    'HR',
    'Mainframe',
    'COBOL',
    'QA',
    'Security',
  ],
  location: [
    'Remote',
    'Bengaluru',
    'Hyderabad',
    'Pune',
    'Mumbai',
    'Delhi',
    'Noida',
    'Gurugram',
    'Chennai',
    'Kolkata',
    'Ahmedabad',
    'Jaipur',
    'Lucknow',
    'Chandigarh',
    'Kochi',
    'Indore',
    'Bhopal',
    'Nagpur',
    'Coimbatore',
    'Visakhapatnam',
    'Bhubaneswar',
    'Patna',
    'Guwahati',
    'Goa',
  ],
  level: ['Intern', 'Fresher', 'Junior', 'Mid', 'Senior', 'Lead', 'Staff', 'Manager', 'Director'],
  keyword: [
    'COBOL',
    'Mainframe',
    'DB2',
    'CICS',
    'Java',
    'React',
    'AWS',
    'SQL',
    'P&L',
    'GTM',
    'SAP',
  ],
  skill: ['COBOL', 'DB2', 'Java', 'Python', 'React', 'SQL', 'AWS', 'P&L', 'Excel', 'Power BI'],
  company: [
    'Amazon',
    'Flipkart',
    'Google',
    'IBM',
    'Infosys',
    'Microsoft',
    'Razorpay',
    'Samsung',
    'TCS',
  ],
  industry: [
    'Software',
    'Fintech',
    'Banking',
    'E-commerce',
    'Retail',
    'SaaS',
    'Consulting',
    'FMCG',
  ],
  employment: ['Full-time', 'Contract', 'Internship', 'Part-time', 'Freelance'],
};

async function authHeaders(user: User): Promise<HeadersInit> {
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export async function fetchCatalog(user: User): Promise<CatalogLists> {
  const res = await fetch(apiUrl('/preferences/catalog'), { headers: await authHeaders(user) });
  if (!res.ok) return FALLBACK_CATALOG;
  const json = (await res.json()) as { lists?: CatalogLists };
  return json.lists ?? FALLBACK_CATALOG;
}

export async function addCatalogOption(
  user: User,
  kind: keyof CatalogLists,
  label: string,
): Promise<CatalogLists> {
  const res = await fetch(apiUrl('/preferences/catalog'), {
    method: 'POST',
    headers: await authHeaders(user),
    body: JSON.stringify({ kind, label }),
  });
  if (!res.ok) throw new Error('Could not add that to the list');
  const json = (await res.json()) as { lists: CatalogLists };
  return json.lists;
}
