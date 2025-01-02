# OctoFox - octopus-foxcloud-connector

FoxEss FoxCloud App v2 is pretty good. It offers capability to link with Octopus Agile, but I've found that occasionally it stops automating the draw overnight when the prices are low.

Other limitations:
* Can only set 2 drawdown times
* Can only use one static "buy below X" number.
* Can't perform intelligent peak-shaving. If the battery charges overnight but drains before the evening peak, you'll be stuck paying the high rates as the battery is empty.

This small `bun` application intends to address these limitations in the following ways:

* Use node-scheduler to run every day at 11pm to prepare for the next day
* Finds the largest block of prices one standard deviation _below_ the average price for the day. This is almost always 1am~5am. marks this for charging time.
  * If this fails to get 8 adjacent half hour blocks (empirically about enough to fill my battery) it reduces the number of standard deviations (0.95, 0.9, etc) required
* Finds the daily peak (1 standard deviation above average for the day), and it's width. Charges the battery to at least 60% before this peak (empirically what I need to get though the peak to a time when prices are back to cheap). 
  * If the peak is wider, the charging period is also wider.
  * Similarly reduces the number of s.d. until we get at least _a_ peak.
  * If the battery reaches 80% during the charging period, it fires a request to stop charging from grid. This usually happens on clear days when the solar panels are doing good work.


To install dependencies:

```bash
bun install
```

Set Envs
```
OCTOPUS_API_KEY=<generate at https://octopus.energy/dashboard/new/accounts/personal-details/api-access>
OCTOPUS_ACCOUNT_NUMBER=<https://octopus.energy/dashboard/new/accounts/THIS_IS_YOUR_ACCOUNT_NUMBER/dashboard>
FOXCLOUD_API_KEY=<generate at https://www.foxesscloud.com/user/center>
FOXCLOUD_SN=<Serial number of inverter can be found in the return of src/foxCloud/getDevices()>
```

To run:

```bash
bun run start
```

