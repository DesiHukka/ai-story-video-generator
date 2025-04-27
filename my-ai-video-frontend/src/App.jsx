import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Preview from "./pages/Preview";
import Final from "./pages/Final";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/preview" element={<Preview />} />
        <Route path="/final" element={<Final />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
