import { MD5 } from "bun";
import winston from "winston";

const { FOXCLOUD_API_KEY, FOXCLOUD_SN } = process.env;

const API_ROOT = "https://www.foxesscloud.com";

export interface HourMin {
  hour: number,
  minute: number
}

export interface BatteryChargeBody {
  sn: string,
  enable1: boolean,
  enable2: boolean,
  startTime1: HourMin,
  endTime1: HourMin,
  startTime2: HourMin,
  endTime2: HourMin,
}

const defaultBody: BatteryChargeBody = {
  sn: FOXCLOUD_SN as string,
  enable1: false,
  enable2: false,
  startTime1: {
    hour: 0,
    minute: 0
  },
  endTime1: {
    hour: 0,
    minute: 0
  },
  startTime2: {
    hour: 0,
    minute: 0
  },
  endTime2: {
    hour: 0,
    minute: 0
  },
}

const sign = (url: string) => {
  const timestamp = new Date().valueOf();

  const signature = MD5.hash(`${url}\\r\\n${FOXCLOUD_API_KEY}\\r\\n${timestamp.toString()}`, "hex");
  return {
    "Content-Type": "application/json",
    token: FOXCLOUD_API_KEY as string,
    Signature: signature,
    Timestamp: timestamp.toString(),
    lang: "en"
  }
}

const fetchAndSign = (path: string, init?: RequestInit, params: Record<string, string> = {}) => {
  const url = new URL(`${API_ROOT}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      url.searchParams.append(key, val)
    })
  }
  return fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      ...sign(path)
    }
  });
}

const getPlant = async () => {
  const res = await fetchAndSign(`/op/v0/plant/list`, {
    method: "POST",
    body: JSON.stringify({ currentPage: 1, pageSize: 10 })
  });
  const parsed = await res.json();
  return parsed;
}

const getDevices = async () => {
  const res = await fetchAndSign(`/op/v0/device/list`, {
    method: "POST",
    body: JSON.stringify({ currentPage: 1, pageSize: 10 })
  });
  const parsed = await res.json();
  return parsed;
}

const getCurrentBatteryChargeSettings = async () => {
  const res = await fetchAndSign(`/op/v0/device/battery/forceChargeTime/get`, undefined, {
    sn: FOXCLOUD_SN as string
  });
  const parsed = await res.json();
  return parsed;
}

const getSchedulerSettings = async () => {
  const res = await fetchAndSign(`/op/v0/device/scheduler/get/flag`, {
    method: 'POST',
    body: JSON.stringify({ deviceSN: FOXCLOUD_SN })
  });
  const parsed = await res.json();
  return parsed;
}

const setCurrentBatteryChargeSettings = async (body: Partial<BatteryChargeBody>) => {
  const res = await fetchAndSign("/op/v0/device/battery/forceChargeTime/set", {
    method: 'POST',
    body: JSON.stringify({ ...defaultBody, ...body }),
  });
  const parsed = await res.json();
  if (parsed.errno !== 0) {
    winston.error("Could not update charge settings", parsed.errno, parsed.result)
  }
  return parsed;
}

const getCurrentBatteryLevel = async (): Promise<number> => {
  const res = await fetchAndSign("/op/v0/device/real/query", {
    method: 'POST',
    body: JSON.stringify({
      variables: ["SoC"],
      sn: FOXCLOUD_SN as string
    })
  });
  const parsed = await res.json();
  return parsed.result[0].datas[0].value;
}

export default {
  getPlant,
  getDevices,
  getCurrentBatteryChargeSettings,
  setCurrentBatteryChargeSettings,
  getCurrentBatteryLevel,
  getSchedulerSettings,
}

if (Bun.main) {
  getCurrentBatteryChargeSettings().then(console.log);
}