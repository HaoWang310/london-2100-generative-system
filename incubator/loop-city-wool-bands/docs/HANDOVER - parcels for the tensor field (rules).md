# Hand-over: the parcels the wool sends to the tensor field (21 Nov 2026)

For whoever works on the tensor field next (the tensor chat, Hao). It says what arrives from the wool bands page, and the rules that must hold after it.

## The rules

1. **The tensor field runs on urban parcels only.** Only parcels the wool marks as urban are sent as the site.
2. **A park stays a park.** A small parcel marked as a park can be picked together with the urban parcels. It travels with them, it is drawn solid green in the base page, and **the tensor field must not run on it**, now or later.
3. **Farming, protected and open parcels are not taken.** They cannot be picked in the wool page. Farming parcels stay farm parcels for now; a rule for them comes later.
4. **Several parcels are one site.** Their outline is taken together, with the roads between them closed over. Parks are left out of that outline.
5. **Several cells stay several cells.** When more than one mould cell is opened in the wool, each keeps its own edge as a 90 m boundary highway. They are never merged into one outline.

## How a parcel gets its use

| Use | Rule |
|---|---|
| Urban | Over half of the parcel is built in the growth result, or over half is built-up today |
| Farming | Over half of the parcel is farming in the growth result |
| Park | The parcel is under 25 ha (slider "A park is a parcel under") |
| Protected | Over half of the parcel is inside a protected landscape (AONB) |
| Open | The growth result gives it almost no use (under 10 %) |

Where neither built nor farming is over half, the larger of the two decides. Each parcel is measured to the centre lines of the roads round it.

## What is in the package

The wool page sends one package (`loop-city-parcel-package`, version 2), in British National Grid metres. The base page turns it into the site file the tensor app reads.

| Field | What it holds |
|---|---|
| `parcels` | The urban parcels: id, cell, area, outline at the true road edge, holes, the roads along each |
| `parks` | The parks taken with them, same shape. **No tensor field here** |
| `site.rings` | The site for the tensor field: the outline of the urban parcels together |
| `site.junctions` | Short stubs across the site edge where three or more roads meet, so the tensor app anchors a street there |
| `roads` | Every road in the window with its class and true width. Existing roads are among them, on their real lines |
| `surface` | The roads as outlines at their true widths, corners rounded |
| `existing` | Today's roads, rail, water and towns, for the base map |
| `rules` | These rules, as text |

## Road classes in the package

| Letter in the package | Road | Width |
|---|---|---|
| M | Boundary highway (the cell edge) | 90 m |
| A | Primary road | 60 m |
| B | A road | 48 m |
| C | B road | 24 to 30 m |

The letters are the ones the base page already read from the older wool. The names and widths are the new hierarchy.

## What the tensor app still has to do

- **Read `features.parks` in the site file as keep-out areas.** The base page writes them, but the tensor app does not know that field yet. Until it does, the parks are safe only because they are outside the site outline. A park fully surrounded by picked urban parcels would lie inside the outline, so the tensor app must honour the list.
- The size limits are unchanged: a site up to 3.6 km across and at least 2 ha. The base page says so when a pick is too wide.
