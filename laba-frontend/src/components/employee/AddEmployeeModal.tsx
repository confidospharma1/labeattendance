'use client';

import React from 'react';
import { EmployeeFormModal } from './EmployeeFormModal';

export const AddEmployeeModal: React.FC<{ isOpen: boolean; onClose: () => void; branches: any[]; onSuccess: () => void }> = (props) => (
  <EmployeeFormModal mode="add" {...props} />
);
