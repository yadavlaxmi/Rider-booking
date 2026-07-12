// import DriverPage from "./pages/DriverPage";
// import PassengerPage from "./pages/PassengerPage";

// function App() {
//   return <DriverPage />;
//   return <PassengerPage />;
// }

// export default App;


import { useState } from "react";
import DriverPage from "./pages/DriverPage";
import PassengerPage from "./pages/PassengerPage";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState("drivers");

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Bike Booking Redis Demo</p>
          <h1>Live booking and dispatch center</h1>
        </div>

        <div className="tab-switcher" role="tablist" aria-label="Main navigation">
          <button
            className={activeTab === "drivers" ? "tab-button tab-button--active" : "tab-button"}
            type="button"
            onClick={() => setActiveTab("drivers")}
          >
            Drivers
          </button>
          <button
            className={activeTab === "passengers" ? "tab-button tab-button--active" : "tab-button"}
            type="button"
            onClick={() => setActiveTab("passengers")}
          >
            Passenger booking
          </button>
        </div>
      </header>

      <main>
        {activeTab === "drivers" ? <DriverPage /> : <PassengerPage />}
      </main>
    </div>
  );
}

export default App;