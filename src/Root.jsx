import { useEffect, useState } from "react";
import App from "./App.jsx";
import ChitoseApproachControlAreaReplica from "./prototypes/rjcc-jaip/ChitoseApproachControlAreaReplica.jsx";
import RjccProcedurePlayback from "./prototypes/rjcc-procedure-playback/RjccProcedurePlayback.jsx";
import RjccProcedureTraceEditor from "./prototypes/rjcc-trace-editor/RjccProcedureTraceEditor.jsx";

export default function Root() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (hash === "#/rjcc-jaip") return <ChitoseApproachControlAreaReplica />;
  if (hash === "#/rjcc-trace-editor") return <RjccProcedureTraceEditor />;
  if (hash === "#/rjcc-procedure-playback") return <RjccProcedurePlayback />;
  return <App />;
}
