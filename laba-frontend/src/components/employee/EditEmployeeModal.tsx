'use client';

import React from 'react';
import { EmployeeFormModal } from './EmployeeFormModal';

export const EditEmployeeModal: React.FC<{
  isOpen: boolean;
  employee: any | null;
  branches: any[];
  onClose: () => void;
  onSuccess: () => void;
}> = (props) => <EmployeeFormModal mode="edit" {...props} />;
