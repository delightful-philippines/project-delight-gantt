-- Add Jonald to employees table with a Business Unit
INSERT INTO employees (employee_id, first_name, last_name, company_email_add, business_unit, position, department)
VALUES (1001, 'Jonald', 'Penpillo', 'jonald.penpillo@brigada.com.ph', 'BRIGADA DISTRIBUTIONS. INC. - CSG', 'Lead Developer', 'Engineering')
ON CONFLICT (employee_id) DO UPDATE SET business_unit = 'BRIGADA DISTRIBUTIONS. INC. - CSG';
