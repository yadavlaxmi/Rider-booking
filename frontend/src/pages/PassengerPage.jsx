import { useState } from "react";
import axios from "axios";

function PassengerPage() {

  const [latitude,setLatitude]=useState("");

  const [longitude,setLongitude]=useState("");

  const [drivers,setDrivers]=useState([]);

  async function findDrivers(){

    const res=await axios.post(
      "http://localhost:5000/passengers/nearby",
      {
        latitude:Number(latitude),
        longitude:Number(longitude)
      }
    );

    setDrivers(res.data.drivers);

  }

  return(

    <div style={{padding:40}}>

      <h1>Passenger</h1>

      <input
      placeholder="Latitude"
      value={latitude}
      onChange={(e)=>setLatitude(e.target.value)}
      />

      <br/><br/>

      <input
      placeholder="Longitude"
      value={longitude}
      onChange={(e)=>setLongitude(e.target.value)}
      />

      <br/><br/>

      <button onClick={findDrivers}>
        Find Drivers
      </button>

      <hr/>

      <h2>Nearby Drivers</h2>

      {
        drivers.map((driver)=>(
          <div
          key={driver.member}
          style={{
            border:"1px solid gray",
            padding:10,
            marginBottom:10
          }}
          >

            <h3>{driver.member}</h3>

            <p>Distance : {driver.distance} KM</p>

          </div>
        ))
      }

    </div>

  );

}

export default PassengerPage;