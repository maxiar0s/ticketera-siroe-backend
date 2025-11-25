import db from "../config/db.js";
import { LogSistemaModel, CuentaModel } from "../models/index.js";
import dotenv from "dotenv";

dotenv.config();

const API_URL = "http://localhost:3000";
const TEST_EMAIL = `test_log_${Date.now()}@test.com`;
const TEST_PASSWORD = "password123";

async function verifyLogging() {
  console.log("Starting verification...");

  try {
    // 0. Create User
    console.log("Creating Test User...");
    const bcrypt = await import("bcrypt");
    const hashedPassword = await bcrypt.default.hash(TEST_PASSWORD, 10);

    // Ensure we create an admin user to access /logs
    const user = await CuentaModel.create({
      name: "Test Logger",
      email: TEST_EMAIL,
      password: hashedPassword,
      tipoCuentaId: 1, // Assuming 1 exists
      telefono: "123456789",
      tipo: "admin", // Important for accessing /logs
    });

    console.log(`User created: ${TEST_EMAIL}`);

    // 1. Login
    console.log("Testing Login...");
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });

    const loginData = await loginRes.json();

    if (!loginData.token) {
      console.error("Login failed:", loginData);
      return;
    }
    const token = loginData.token;
    console.log("Login successful, token received.");

    // 2. Make a request (should be logged)
    console.log("Testing Request Logging...");
    await fetch(`${API_URL}/perfil`, {
      headers: { token: `Bearer ${token}` },
    });
    console.log("Request made.");

    // 3. Test GET /logs
    console.log("Testing GET /logs endpoint...");
    const logsRes = await fetch(`${API_URL}/logs`, {
      headers: { token: `Bearer ${token}` },
    });

    if (logsRes.status === 200) {
      const logsData = await logsRes.json();
      console.log(`GET /logs successful. Retrieved ${logsData.length} logs.`);
      if (logsData.length > 0) {
        console.log("Sample log:", logsData[0]);
      }
    } else {
      console.error(`GET /logs failed with status ${logsRes.status}`);
      const errData = await logsRes.json();
      console.error(errData);
    }

    // 4. Logout
    console.log("Testing Logout...");
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { token: `Bearer ${token}` },
    });
    console.log("Logout successful.");

    // Cleanup
    await user.destroy();
    await LogSistemaModel.destroy({ where: { usuarioId: user.id } });
  } catch (error) {
    console.error("Verification failed:", error.message);
    console.error(error);
  } finally {
    // Close DB connection if needed
    // process.exit(0);
  }
}

verifyLogging();
