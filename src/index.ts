import { addDays } from "date-fns";
import schedule from 'node-schedule';
import winston from "winston";
import FoxCloud, { BatteryChargeBody } from "./foxCloud";
import Octopus from './octopus';
import { buildRangeBackwards, isoToHourMin, parseIsoNoMilliSeconds, stretchToRange } from "./utils";

winston.configure({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.printf(({ timestamp, level, message, service, ...rest }) => `${JSON.stringify({
      timestamp,
      level,
      message,
      rest
    })}`),
  ),
  defaultMeta: { service: "octofox" },
  transports: [
    new winston.transports.File({ filename: 'octofox-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'octofox-combined.log' }),
    new winston.transports.Console({
      level: "debug",
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
})


const getBestRangesForDate = async (d: Date) => {
  const processedRates = await Octopus.getDayRates(d).then(Octopus.processRates);
  const stats = Octopus.getDayStats(processedRates);
  const longestStretchUnder = Octopus.getLongestStretchUnder1std(processedRates, stats.std, stats.mean);
  const longestStretchOver = Octopus.getLongestStretchOver1std(processedRates, stats.std, stats.mean);
  // first range is expected to be overnight
  const firstRange = stretchToRange(longestStretchUnder);
  const secondRange = buildRangeBackwards(Object.keys(longestStretchOver[0])[0], longestStretchOver.length)

  return { firstRange, secondRange }
}

const rangesToBatterySetting = (first: [string, string], second: [string, string]): Partial<BatteryChargeBody> => {
  return {
    enable1: true,
    enable2: true,
    startTime1: isoToHourMin(first[0]),
    endTime1: isoToHourMin(first[1]),
    startTime2: isoToHourMin(second[0]),
    endTime2: isoToHourMin(second[1]),
  }
}

const main = async () => {
  const { firstRange, secondRange } = await getBestRangesForDate(addDays(new Date(), 1));

  winston.debug("ranges", firstRange, secondRange);

  const batteryLevel = await FoxCloud.getCurrentBatteryLevel();
  winston.debug("battery level %d", batteryLevel);

}

const checkDone = async () => {
  const batteryLevel = await FoxCloud.getCurrentBatteryLevel();
  winston.debug("Current level %d%", batteryLevel);
  if (batteryLevel > 80) {
    winston.info("Battery Sufficiently full. stopping midday charge.");
    // defaults to disabling all 
    await FoxCloud.setCurrentBatteryChargeSettings({});
  }
}

winston.info("Booting")

// 11pm every day
schedule.scheduleJob("0 0 23 * * *", async () => {
  const { firstRange, secondRange } = await getBestRangesForDate(addDays(new Date(), 1));

  winston.info(`Calculating Tomorrow's charging`, {
    first: { start: firstRange[0], end: firstRange[1] },
    second: { start: secondRange[0], end: secondRange[1] }
  })

  const start2 = parseIsoNoMilliSeconds(secondRange[0])
  const end2 = parseIsoNoMilliSeconds(secondRange[1])
  await FoxCloud.setCurrentBatteryChargeSettings(rangesToBatterySetting(firstRange, secondRange));
  // we may be able to stop the second charge early, 
  // since if the battery runs out overnight, the prices are fine anyway.
  schedule.scheduleJob("checkDone", { start: start2, end: end2, rule: "*/5 * * * * *" }, checkDone)
});

if (Bun.main && process.env.NODE_ENV === 'DEBUG') {
  main();
}