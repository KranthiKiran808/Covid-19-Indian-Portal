const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json()); // Built-in middleware to parse JSON
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const convertPascalToCamelcase = (data) => {
  const formattedData = data.map((each) => ({
    stateId: each.state_id,
    stateName: each.state_name,
    population: each.population,
  }));
  return formattedData;
};

const convertPascalCaseToCamelCaseForDistrict = (data) => {
  const formattedData = {
    districtId: data.district_id,
    districtName: data.district_name,
    stateId: data.state_id,
    cases: data.cases,
    cured: data.cured,
    active: data.active,
    deaths: data.deaths,
  };
  return formattedData;
};

app.post(`/login`, async (request, response) => {
  const { username, password } = request.body;

  const userQuery = `SELECT * FROM user WHERE username='${username}';`;
  const user = await db.get(userQuery);

  if (user === undefined) {
    response.send(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.send(400);
      response.send("Invalid password");
    }
  }
});

const logger = (request, response, next) => {
  let jwtToken = "";
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 2

app.get("/states", logger, async (request, response) => {
  const statesQuery = `SELECT * FROM state`;
  const data = await db.all(statesQuery);

  const formattedData = convertPascalToCamelcase(data);

  response.send(formattedData);
});

//API 3

app.get("/states/:stateId", logger, async (request, response) => {
  const statesQuery = `SELECT * FROM state WHERE state_id=${request.params.stateId};`;
  const data = await db.all(statesQuery);
  const formattedData = convertPascalToCamelcase(data);

  response.send(formattedData);
});

//API 4

app.post("/districts/", logger, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const districtQuery = `INSERT INTO district(district_name, state_id, cases, cured, active, deaths) VALUES('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths})`;
  await db.run(districtQuery);
  response.send("District Successfully Added");
});

//API 5

app.get(`/districts/:districtId/`, logger, async (request, response) => {
  const { districtId } = request.params;
  const districtQuery = `SELECT
   * FROM 
   district
    WHERE district_id=${districtId}`;
  const data = await db.get(districtQuery);
  const formattedData = convertPascalCaseToCamelCaseForDistrict(data);
  response.send(formattedData);
});

//API 6

app.delete(`/districts/:districtId/`, logger, async (request, response) => {
  const { districtId } = request.params;
  const deleteQuery = `DELETE FROM district
    WHERE district_id=${districtId}`;
  const data = await db.run(deleteQuery);
  response.send("District Removed");
});

//API 7

app.put(`/districts/:districtId/`, logger, async (request, response) => {
  const { districtId } = request.params;
  const selectedUser = `SELECT 
  * FROM district 
  WHERE district_id = ${districtId}`;
  const data = db.get(selectedUser);

  const {
    districtName = data.district_name,
    stateId = data.state_id,
    cases = data.cases,
    cured = data.cured,
    active = data.active,
    deaths = data.deaths,
  } = request.body;

  const updatedQuery = `UPDATE district SET 

  district_name = ${districtName},
  state_id = ${state_id},
  cases=${cases},
  cured=${cured},
  active=${active},
  deaths=${deaths},
  WHERE district_id = ${districtId}`;
  await db.run(updatedQuery);
  response.send("District Details Updated");
});

//API 8

app.get(`/states/:stateId/stats/`, logger, async (request, response) => {
  const { stateId } = request.params;
  const statsQuery = `
    SELECT 
      SUM(cases) as totalCases,
      SUM(cured) as totalCured,
      SUM(active) as totalActive,
      SUM(deaths) as totalDeaths
    FROM 
      district
    WHERE 
      state_id = ${stateId}`;
  const data = await db.get(statsQuery);
  response.send(data);
});

module.exports = app;
