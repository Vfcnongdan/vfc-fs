import 'dotenv/config';
import { getNearestAgencies } from "../src/services/agencyService";

async function test() {
  try {
    const agencies = await getNearestAgencies(10.8403, 105.18);
    console.log('Query result:', JSON.stringify(agencies, null, 2));
  } catch (error) {
    console.error('Query failed:', error);
  }
}

test();
