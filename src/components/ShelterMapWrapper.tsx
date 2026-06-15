'use client';

import dynamic from 'next/dynamic';
import { ShelterData } from './ShelterMap';

const DynamicShelterMap = dynamic(() => import('./ShelterMap'), { 
  ssr: false,
  loading: () => (
    <div className="h-[500px] w-full bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-slate-500">
      Initializing Geospatial Map...
    </div>
  )
});

interface WrapperProps {
  shelters: ShelterData[];
  userLocation?: [number, number];
}

export default function ShelterMapWrapper(props: WrapperProps) {
  return <DynamicShelterMap {...props} />;
}