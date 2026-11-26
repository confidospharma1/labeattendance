'use client';

import React from 'react';
import { LocationModal } from './LocationModal';

export const AddBranchModal: React.FC<{ isOpen: boolean; onClose: () => void; onSuccess: () => void }> = (props) => (
  <LocationModal mode="add" {...props} />
);
