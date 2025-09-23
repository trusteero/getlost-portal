#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const port = process.argv[2] || '3000';

async function killPort(port) {
  try {
    // Find process using the port
    const { stdout } = await execAsync(`lsof -ti :${port}`);

    if (stdout.trim()) {
      const pid = stdout.trim();
      console.log(`Killing process ${pid} on port ${port}...`);
      await execAsync(`kill -9 ${pid}`);
      console.log(`Process killed successfully.`);
    } else {
      console.log(`No process found on port ${port}.`);
    }
  } catch (error) {
    // lsof returns error if no process found, which is fine
    if (error.code === 1) {
      console.log(`Port ${port} is free.`);
    } else {
      console.error(`Error checking port: ${error.message}`);
    }
  }
}

killPort(port);