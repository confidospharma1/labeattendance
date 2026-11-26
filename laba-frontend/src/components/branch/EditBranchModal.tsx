'use client';

import React from 'react';
import { LocationModal } from './LocationModal';

export const EditBranchModal: React.FC<{ isOpen: boolean; branch: any | null; onClose: () => void; onSuccess: () => void }> = (props) => (
  <LocationModal mode="edit" {...props} />
);
