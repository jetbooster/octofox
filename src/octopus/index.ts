import { addDays, startOfDay } from "date-fns";
import * as Mathjs from 'mathjs';

const OCTOPUS_RATES_URL = "https://api.octopus.energy/v1/products/AGILE-24-10-01/electricity-tariffs/E-1R-AGILE-24-10-01-G/standard-unit-rates/";

const { OCTOPUS_API_KEY, OCTOPUS_ACCOUNT_NUMBER } = process.env;

interface FullRate {
  value_exc_vat: number,
  value_inc_vat: number,
  valid_from: string,
  valid_to: string,
}

export type Rate = Record<string, number>;

const getCurrentTariffName = async (apiKey: String): Promise<String> => {
  const result = await fetch(`https://api.octopus.energy/v1/accounts/${OCTOPUS_ACCOUNT_NUMBER}/`, {
    headers: {
      Authorization: `${apiKey}`
    }
  });
  const parsed = await result.json();
  return parsed.properties[0].electricity_meter_points[0].agreements[1].tariff_code;

}

const getToken = async (): Promise<String> => {
  const body = {
    query: "mutation krakenTokenAuthentication($api: String!) { obtainKrakenToken(input: {APIKey: $api}) { token } }",
    variables: {
      "api": OCTOPUS_API_KEY
    }
  };
  const resp = await fetch("https://api.octopus.energy/v1/graphql/", {
    headers: {
      "Content-Type": "application/json"
    },
    method: 'POST',
    body: JSON.stringify(body),
  });
  return (await resp.json()).data.obtainKrakenToken.token;
}

const getDayRates = async (d: Date): Promise<FullRate[]> => {
  const url = new URL(OCTOPUS_RATES_URL);
  url.searchParams.append("period_from", `${startOfDay(d).toISOString().slice(0, 16)}Z`);
  url.searchParams.append("period_to", `${startOfDay(addDays(d, 1)).toISOString().slice(0, 16)}Z`);
  url.search = decodeURIComponent(url.search);
  const result = await fetch(url, {
    headers: {
      Authorization: `Token ${OCTOPUS_API_KEY}`
    }
  });
  const parsed = await result.json();
  return parsed.results;
}

const processRates = (rates: FullRate[]): Rate => {
  return rates.reverse().reduce((acc, rate) => {
    acc[rate.valid_from] = rate.value_inc_vat;
    return acc;
  }, {} as Record<string, number>)
}

const getDayStats = (rate: Rate) => {
  const vals: number[] = Object.values(rate);
  const maxVal = Mathjs.max(vals);
  const minVal = Mathjs.min(vals);
  const mean = Mathjs.mean(vals);
  const std = Mathjs.std(vals) as unknown as number;
  return {
    max: maxVal,
    min: minVal,
    mean,
    std,
  }
}

const getLongestStretchUnder1std = (rate: Rate, std: number, mean: number) => {
  const stretches: Rate[][] = [];
  let reset = true
  Object.entries(rate).forEach((entry) => {
    if (entry[1] < (mean - std)) {
      if (reset) {
        stretches.push([]);
        reset = false;
      }
      stretches[stretches.length - 1].push({ [entry[0]]: entry[1] })
    } else {
      reset = true;
    }
  })
  stretches.sort((a, b) => b.length - a.length);
  const bestStretch = stretches[0];
  // if stretch is too short, relax how low the number needs to be
  if (bestStretch.length < 8) {
    return getLongestStretchUnder1std(rate, std * 0.95, mean)
  }
  return bestStretch;
}

const getLongestStretchOver1std = (rate: Rate, std: number, mean: number) => {
  const stretches: Rate[][] = [];
  let reset = true
  Object.entries(rate).forEach((entry) => {
    if (entry[1] > (mean + std)) {
      if (reset) {
        stretches.push([]);
        reset = false;
      }
      stretches[stretches.length - 1].push({ [entry[0]]: entry[1] })
    } else {
      reset = true;
    }
  })
  stretches.sort((a, b) => b.length - a.length);
  const bestStretch = stretches[0];
  // if stretch is too short, relax how low the number needs to be
  if (bestStretch.length < 6) {
    return getLongestStretchUnder1std(rate, std * 0.95, mean)
  }
  return bestStretch;
}

export default {
  getLongestStretchOver1std,
  getLongestStretchUnder1std,
  processRates,
  getCurrentTariffName,
  getDayRates,
  getDayStats,
  getToken,
}