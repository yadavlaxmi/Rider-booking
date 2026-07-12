import { useState } from "react";
import axios from "axios";

function DriverPage() {
  const [driverId, setDriverId] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const goOnline = async () => {
    try {
      const res = await axios.post(
        "http://localhost:5000/drivers/online",
        {
          driverId,
          latitude: Number(latitude),
          longitude: Number(longitude),
        }
      );

      alert(res.data.message);
    } catch (err) {
      alert(err.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Driver Dashboard</h1>

      <input
        placeholder="Driver ID"
        value={driverId}
        onChange={(e) => setDriverId(e.target.value)}
      />
      <br /><br />

      <input
        placeholder="Latitude"
        value={latitude}
        onChange={(e) => setLatitude(e.target.value)}
      />
      <br /><br />

      <input
        placeholder="Longitude"
        value={longitude}
        onChange={(e) => setLongitude(e.target.value)}
      />
      <br /><br />

      <button onClick={goOnline}>
        Go Online
      </button>
    </div>
  );
}

export default DriverPage;