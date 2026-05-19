import { useEffect, useState } from "react";
import App from "./App.jsx";
import ChitoseApproachControlAreaReplica from "./prototypes/rjcc-jaip/ChitoseApproachControlAreaReplica.jsx";

export default function Root() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (hash === "#/rjcc-jaip") return <ChitoseApproachControlAreaReplica />;
  return <App />;
}
