"use client";

import { createContext, useContext, useState, use } from "react";
import { Config } from "@/types/config";

export type ConfigState = {
  config: Config | null;
  error: "branch_not_found" | "forbidden" | null;
};

type ConfigContextType = {
  configPromise: Promise<ConfigState>;
  configOverride: Config | null | undefined;
  setConfig: (config: Config | null) => void;
};

const ConfigContext = createContext<ConfigContextType>({
  configPromise: Promise.resolve({ config: null, error: null }),
  configOverride: undefined,
  setConfig: () => {},
});

export const useConfig = () => {
  const { configPromise, configOverride, setConfig } = useContext(ConfigContext);
  const config =
    configOverride !== undefined
      ? configOverride
      : use(configPromise).config;
  return { config, setConfig };
};

export const useConfigPromise = () => useContext(ConfigContext).configPromise;

export const ConfigProvider = ({
  configPromise,
  children,
}: {
  configPromise: Promise<ConfigState>;
  children: React.ReactNode;
}) => {
  const [configOverride, setConfig] = useState<Config | null | undefined>(undefined);

  return (
    <ConfigContext.Provider value={{ configPromise, configOverride, setConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};
