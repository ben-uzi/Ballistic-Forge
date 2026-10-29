"""Generate external reference trajectories for Ballistic Forge using py-ballisticcalc.

py-ballisticcalc is an independent, LGPL point-mass solver whose core descends from the
public JBM C sources. Inputs below are TEST INPUTS chosen to span the envelope (G1/G7,
light/heavy, standard/non-standard air, wind, incline). They are not library data and
make no claim about any real product's BC or velocity.

Spin drift and Coriolis are disabled on both sides so the comparison isolates drag,
gravity, atmosphere, wind and zeroing.
"""
import json
import importlib.metadata as md
from py_ballisticcalc import (
    Ammo, Angular, Atmo, Calculator, Distance, DragModel, Pressure, Shot, TableG1, TableG7,
    Temperature, Velocity, Weapon, Weight, Wind,
)

CASES = [
    dict(id="g7_65cm_140_std", label="6.5mm 140 gr, G7 0.326, 2710 fps, ICAO std, no wind",
         drag="G7", bc=0.326, weight_gr=140, diameter_in=0.264, mv_fps=2710,
         sight_height_in=1.5, zero_yd=100, temp_f=59.0, pressure_inhg=29.92, pressure_type="station",
         altitude_ft=0, rh=0, wind_mph=0, wind_clock=3, incline_deg=0, max_yd=1000),
    dict(id="g7_308_175_wind", label=".308 175 gr, G7 0.243, 2600 fps, ICAO std, 10 mph from 3 o'clock",
         drag="G7", bc=0.243, weight_gr=175, diameter_in=0.308, mv_fps=2600,
         sight_height_in=1.5, zero_yd=100, temp_f=59.0, pressure_inhg=29.92, pressure_type="station",
         altitude_ft=0, rh=0, wind_mph=10, wind_clock=3, incline_deg=0, max_yd=1000),
    dict(id="g1_223_77_std", label=".224 77 gr, G1 0.372, 2750 fps, ICAO std, no wind",
         drag="G1", bc=0.372, weight_gr=77, diameter_in=0.224, mv_fps=2750,
         sight_height_in=2.6, zero_yd=100, temp_f=59.0, pressure_inhg=29.92, pressure_type="station",
         altitude_ft=0, rh=0, wind_mph=0, wind_clock=3, incline_deg=0, max_yd=800),
    dict(id="g7_300wm_215_cold_high", label=".308 215 gr, G7 0.354, 2850 fps, 20 F, 24.90 inHg station, 50% RH, 5 mph from 9",
         drag="G7", bc=0.354, weight_gr=215, diameter_in=0.308, mv_fps=2850,
         sight_height_in=1.75, zero_yd=100, temp_f=20.0, pressure_inhg=24.90, pressure_type="station",
         altitude_ft=5500, rh=50, wind_mph=5, wind_clock=9, incline_deg=0, max_yd=1200),
    dict(id="g1_6mm_108_hot_humid", label="6mm 108 gr, G1 0.536, 2960 fps, 95 F, 29.00 inHg station, 80% RH, 8 mph from 2 o'clock",
         drag="G1", bc=0.536, weight_gr=108, diameter_in=0.243, mv_fps=2960,
         sight_height_in=1.5, zero_yd=100, temp_f=95.0, pressure_inhg=29.00, pressure_type="station",
         altitude_ft=900, rh=80, wind_mph=8, wind_clock=2, incline_deg=0, max_yd=1000),
]



def run(c):
    table = TableG7 if c["drag"] == "G7" else TableG1
    dm = DragModel(c["bc"], table, Weight.Grain(c["weight_gr"]), Distance.Inch(c["diameter_in"]))
    ammo = Ammo(dm, Velocity.FPS(c["mv_fps"]))
    weapon = Weapon(sight_height=Distance.Inch(c["sight_height_in"]), twist=Distance.Inch(0))
    atmo = Atmo(altitude=Distance.Foot(c["altitude_ft"]),
                pressure=Pressure.InHg(c["pressure_inhg"]),
                temperature=Temperature.Fahrenheit(c["temp_f"]),
                humidity=c["rh"] / 100.0)
    # Zero in the SAME atmosphere (no zero-vs-current mismatch in these cases)
    calc = Calculator()
    zero_shot = Shot(weapon=weapon, ammo=ammo, atmo=atmo)
    calc.set_weapon_zero(zero_shot, Distance.Yard(c["zero_yd"]))
    winds = [Wind(Velocity.MPH(c["wind_mph"]), Angular.OClock(c["wind_clock"]))] if c["wind_mph"] else []
    shot = Shot(weapon=weapon, ammo=ammo, atmo=atmo, winds=winds,
                look_angle=Angular.Degree(c["incline_deg"]))
    res = calc.fire(shot, trajectory_range=Distance.Yard(c["max_yd"]),
                    trajectory_step=Distance.Yard(100))
    rows = []
    for p in res.trajectory:  # noqa
        yd = round(p.distance >> Distance.Yard)
        if yd == 0 or yd % 100:
            continue
        rows.append(dict(
            range_yd=yd,
            path_in=round(p.slant_height >> Distance.Inch, 2),          # + above line of sight
            elev_mil=round(-(p.drop_angle >> Angular.MRad), 2),    # milliradians; + = dial up (NOT Angular.Mil, which is NATO 6400-mil)
            windage_in=round(p.windage >> Distance.Inch, 2),
            wind_mil=round(p.windage_angle >> Angular.MRad, 2),
            velocity_fps=round(p.velocity >> Velocity.FPS, 0),
            tof_s=round(p.time, 3),
        ))
    return rows


out = {
    "schema_note": "Map these fields onto test/fixtures/reference_cases.json's documented schema.",
    "source": {
        "solver": "py-ballisticcalc",
        "version": md.version("py-ballisticcalc"),
        "url": "https://pypi.org/project/py-ballisticcalc/",
        "engine": "default integration engine, point-mass",
        "notes": "Independent LGPL solver derived from public JBM C sources. JBM's online calculators were retired, so they could not be used.",
    },
    "conventions": {
        "path_in": "bullet height relative to line of sight, inches; negative = below",
        "elev_mil": "elevation correction to dial, mils; positive = up",
        "windage_in": "lateral offset, inches; sign follows solver (positive = right)",
        "wind_clock": "py-ballisticcalc Angular.OClock(n) passed as Wind.direction_from: 0/12 = from behind (tailwind), 3 = from the LEFT (pushes right), 6 = headwind, 9 = from the right",
        "spin_drift": "disabled (twist = 0)",
        "coriolis": "disabled",
        "zero_atmosphere": "same as shot atmosphere",
        "pressure_type": "station (absolute) pressure; altitude given for reference only",
        "incline_deg": "0 in all cases; incline is excluded because solvers differ on slant vs horizontal range conventions",
    },
    "suggested_tolerance": {"elev_mil": 0.1, "wind_mil": 0.1, "velocity_fps": 15},
    "cases": [],
}
for c in CASES:
    out["cases"].append(dict(inputs=c, expected=run(c)))

with open("reference_cases.pyballisticcalc.json", "w") as f:
    json.dump(out, f, indent=2)
print(json.dumps(out["cases"][0]["expected"], indent=1)[:1500])
