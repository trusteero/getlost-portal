#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const port = process.argv[2] || '3000';

/**
 * Kill processes running on specified port
 * @param {string} port - The port number
 */
async function killPort(port) {
  try {
    // Find process using the port
    const { stdout } = await execAsync(`lsof -ti :${port}`);

    if (stdout.trim()) {
      const pids = stdout.trim().split('\n');
      for (const pid of pids) {
        if (pid) {
          console.log(`Killing process ${pid} on port ${port}...`);
          try {
            await execAsync(`kill -9 ${pid}`);
            console.log(`Process ${pid} killed successfully.`);
          } catch (killError) {
            console.log(`Could not kill process ${pid}: ${killError?.['message'] || killError}`);
          }
        }
      }
    } else {
      console.log(`No process found on port ${port}.`);
    }
  } catch (error) {
    // lsof returns error if no process found, which is fine
    if (error?.['code'] === 1) {
      console.log(`Port ${port} is free.`);
    } else {
      console.error(`Error checking port: ${error?.['message'] || error}`);
    }
  }
}

killPort(port);