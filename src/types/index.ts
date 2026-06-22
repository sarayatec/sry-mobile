export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'employee';
}

export interface AuthResponse extends User {
  token: string;
}

export type AppointmentStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';

export interface FieldAppointment {
  id: string | number;
  title: string;
  description?: string;
  property_code?: string;
  address?: string;
  lat?: number;
  lng?: number;
  scheduled_at: string;
  employee_id?: number;
  employee_name?: string;
  status: AppointmentStatus;
  created_at?: string;
  customer_name?: string;
  customer_phone?: string;
  appt_notes?: string;
}

export interface PropertyLocation {
  id: number;
  title: string;
  location?: string;
  property_subtype?: string;
  lat?: number;
  lng?: number;
  owner_name?: string;
  owner_number?: string;
}

export interface LiveEmployee {
  id: number;
  name: string;
  lat: number;
  lng: number;
  accuracy?: number;
  updated_at: string;
  status: 'active' | 'offline';
}

export interface LocationPayload {
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}
