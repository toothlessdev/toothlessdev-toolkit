'use client';

import { createContext, useState } from 'react';
import { createPortal } from 'react-dom';

const ProtalContext = createContext<HTMLDivElement | null>(null);

interface PortalProviderProps {
  children: React.ReactNode;
}

const PortalProvider = ({ children }: PortalProviderProps) => {
  const [portalContainerRef, setPortalContainerRef] = useState<HTMLDivElement | null>(null);

  return (
    <ProtalContext.Provider value={portalContainerRef}>
      {children}
      <div
        id='portal-container'
        style={{ zIndex: 1000, position: 'fixed' }}
        ref={(element) => {
          if (portalContainerRef !== null || element === null) {
            return;
          }
          setPortalContainerRef(element);
        }}
      />
    </ProtalContext.Provider>
  );
};

interface PortalConsumerProps {
  children: React.ReactNode;
}

const PortalConsumer = ({ children }: PortalConsumerProps) => {
  return (
    <ProtalContext.Consumer>
      {(portalContainerRef) => {
        if (portalContainerRef === null) {
          return null;
        }
        return createPortal(children, portalContainerRef);
      }}
    </ProtalContext.Consumer>
  );
};

export const GlobalPortal = {
  Provider: PortalProvider,
  Consumer: PortalConsumer,
};
