import fs from "fs";

const file = "/Users/admin/projects/vfc/vfc-farmer-success/src/app/farmer/diagnose/page.tsx";
let code = fs.readFileSync(file, "utf8");

// Add countdown state
const stateStart = code.indexOf('const [loading, setLoading] = useState(false);');
const newStateStart = `const [loading, setLoading] = useState(false);
  const [analyzeCountdown, setAnalyzeCountdown] = useState<number>(20);`;
code = code.replace('const [loading, setLoading] = useState(false);', newStateStart);

// Add useEffect for countdown
const useEffectStart = code.indexOf('useEffect(() => {\n    if (!userCrops.length) {');
const newUseEffect = `useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading && analyzeCountdown > 0) {
      timer = setInterval(() => {
        setAnalyzeCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [loading, analyzeCountdown]);

  useEffect(() => {\n    if (!userCrops.length) {`;
code = code.replace('useEffect(() => {\n    if (!userCrops.length) {', newUseEffect);

// Reset countdown when loading starts
const analyzeStart = code.indexOf('setLoading(true);');
const analyzeEnd = code.indexOf('setError("");', analyzeStart);
const newAnalyzeStart = `setLoading(true);\n    setAnalyzeCountdown(20);\n    setError("");`;
code = code.replace(`setLoading(true);\n    setError("");`, newAnalyzeStart);

// Update button
const buttonStart = code.indexOf('<Search className="h-4 w-4" aria-hidden="true" />');
const buttonEnd = code.indexOf('</button>', buttonStart);
const oldButton = code.slice(buttonStart, buttonEnd);

const newButton = `{loading ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang phân tích ({analyzeCountdown}s)...
                </div>
              ) : (
                <>
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Phân tích bệnh
                </>
              )}
            `;
code = code.replace(oldButton, newButton);

fs.writeFileSync(file, code);
