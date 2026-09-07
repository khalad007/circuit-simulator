# Circuit Engineering Studio

Run the backend from `backend` with `uvicorn main:app --reload`, and the frontend
from `frontend` with `npm install` and `npm run dev`. Open `http://localhost:3000`.
AI features use `GEMINI_API_KEY` in `backend/.env`; `GEMINI_MODEL` optionally
overrides the default model. Restart the backend after changing environment settings.

## Experiment and measure

- Click a component in the sidebar or drag it onto the canvas. Connect terminals
  in either direction. Select a component or wire and press Delete to remove it.
- Start Simulator calculates terminal voltages and branch currents. An LED above
  3.3 V without series resistance explodes and stays **BURNT**, including across
  stop/start and JSON saves. Correct its wiring, then use **Repair LEDs**.
- A zero-resistance path between battery terminals highlights the fault path red,
  reports high current, and stops simulation. An ammeter directly across a battery
  also creates a short.
- Connect voltmeter and oscilloscope probes **across** two terminals. Double-click
  a wire to create a probe junction. Connect an ammeter **in series**, or select an
  unconnected ammeter and double-click the wire where it should be inserted.
- The siren and flip-flop templates include scopes. Start the simulator, then tap
  PUSH for a brief tone or hold it to raise pitch continuously. Short taps stay
  pressed until the backend evaluates them, then sound for at least 180 ms.
  Releasing the button lowers the displayed pitch envelope. The speaker
  mutes when its power path opens. The flip-flop scope samples alternating collector
  voltage; changing its base resistance or capacitance changes the modeled period.
- The LDR template is a light-controlled LED: dark = off, bright = on. Its series
  330-ohm resistor limits current at maximum light. The display treats current
  below 0.5 mA as off; measurement tools still show the calculated small current.

## Save, share, and learn

- **Save JSON** downloads component positions, values, damage state, wires, and
  viewport. **Load JSON** validates the entire file before replacing the canvas.
  Files support up to 100 components, 300 wires, and 2 MB. Runtime callbacks and
  measurement samples are excluded; held pushbuttons are released on load.
- **Export PNG** exports all components, including those outside the visible canvas,
  on white without editor controls. It uses the version of `html-to-image`
  recommended by the [React Flow export example](https://reactflow.dev/examples/misc/download-image).
- **Generate Challenge** asks Gemini for a beginner wiring task. Build it and click
  **Verify Solution** for a score, feedback, and hints. Grading uses the saved task,
  terminal-level graph, and simulation observations. Overloaded solutions cannot
  score above 40. Scores are marked stale when the circuit changes. Challenges
  expire after one hour or a backend restart; generating one keeps the canvas intact.

## Modeling limits

This is an educational simulator, not SPICE. It supports one ideal DC battery,
resistors, ideal switches, and a piecewise LED model (2 V forward drop plus 10 ohms).
Voltmeters/scopes have infinite input impedance; ammeters use a 0.001-ohm shunt.
Floating probes show no reading. Capacitors are open in DC steady state. The
transistor, siren and cross-coupled flip-flop use simplified behavioral models;
oscilloscope voltage history covers 4 seconds, and siren waves illustrate a 20 ms
window of modeled audio (flat when the speaker is unpowered). Each flip-flop
half-period uses its own cross-coupled capacitor and base resistor: approximately
0.693 × R × C, bounded to 0.1–5 seconds for visualization. Unrelated capacitors do
not affect timing. See the [astable circuit explanation](https://www.electronics-tutorials.ws/waveforms/astable.html).
The standalone NPN is a simplified voltage-controlled switch: it closes a 10-ohm
collector/emitter path when the calculated base/emitter voltage reaches 0.7 V.
Resistor-fed bases work, but base current, gain, saturation and transistor breakdown
are not modeled. Capacitor transients are not solved. AI grades can vary between attempts.

Resistance values must be zero (an ideal wire) or at least 0.001 ohms; numerical
inputs must be finite and nonnegative. The canvas and API enforce the same component
and wire limits. AI requests time out instead of leaving controls busy indefinitely.
Clearing or replacing a circuit cancels pending AI generation so late responses
cannot overwrite the new canvas.

## Checks

From the repository root:

```powershell
& backend/venv/Scripts/python.exe -B -m unittest discover -s backend -p 'test_*.py'
```

From `frontend`:

```powershell
npm run lint
npx tsc --noEmit
npm run build
npm run test:e2e
```

Browser tests use headless Microsoft Edge and start local servers when needed.
They use the real circuit solver and stub Gemini only for deterministic challenge
UI checks. Browser traces and PNG examples are written to ignored `test-results/`.
