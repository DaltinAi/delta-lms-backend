import * as admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, Firestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ quiet: true });

let ivrDb: Firestore | null = null;

export function getIvrDb(): Firestore | null {
  if (ivrDb) return ivrDb;

  const ivrCreds = process.env.IVR_FIREBASE_CREDENTIALS;
  if (!ivrCreds) {
    console.warn('IVR_FIREBASE_CREDENTIALS not found in environment');
    return null;
  }

  try {
    let cleanJson = ivrCreds.trim();
    if (cleanJson.startsWith("'") && cleanJson.endsWith("'")) {
      cleanJson = cleanJson.substring(1, cleanJson.length - 1);
    }
    const serviceAccount = JSON.parse(cleanJson);
    const appName = 'ivr-app';

    let ivrApp = getApps().find((app: any) => app?.name === appName);
    if (!ivrApp) {
      ivrApp = initializeApp(
        {
          credential: cert(serviceAccount),
        },
        appName,
      );
    }
    ivrDb = getFirestore(ivrApp);
    return ivrDb;
  } catch (error) {
    console.error('IVR Firebase initialization failed:', error);
    return null;
  }
}

export async function getTodayCallLeadIds(
  companyId: string,
): Promise<Set<string>> {
  const db = getIvrDb();
  if (!db) return new Set();

  try {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const todayIST = new Date(Date.now() + istOffset);
    todayIST.setUTCHours(0, 0, 0, 0);
    const startOfTodayIST = new Date(todayIST.getTime() - istOffset);
    const endOfTodayIST = new Date(
      startOfTodayIST.getTime() + 24 * 60 * 60 * 1000,
    );

    const callsRef = db.collection('ivr').doc(companyId).collection('calls');
    const snapshot = await callsRef
      .where(
        'initiatedAt',
        '>=',
        Timestamp.fromDate(startOfTodayIST),
      )
      .where(
        'initiatedAt',
        '<',
        Timestamp.fromDate(endOfTodayIST),
      )
      .get();

    const leadIds = new Set<string>();
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      if (data.leadId) {
        leadIds.add(data.leadId);
      }
    });
    return leadIds;
  } catch (error) {
    console.error('Error fetching today call lead IDs:', error);
    return new Set();
  }
}
export async function getCallMetrics(
  companyId: string,
  startDate: Date,
  endDate: Date,
  agentId?: string,
): Promise<{
  avgCallDuration: number;
  pickupResponse: number;
  connectedCalls: number;
  totalAttempts: number;
}> {
  const db = getIvrDb();
  if (!db) {
    return {
      avgCallDuration: 0,
      pickupResponse: 0,
      connectedCalls: 0,
      totalAttempts: 0,
    };
  }

  try {
    const callsRef = db.collection('ivr').doc(companyId).collection('calls');
    let query = callsRef
      .where('initiatedAt', '>=', Timestamp.fromDate(startDate))
      .where('initiatedAt', '<', Timestamp.fromDate(endDate));

    if (agentId) {
      query = query.where('userId', '==', agentId);
    }

    const snapshot = await query.get();

    let totalDuration = 0;
    let totalTimeToPick = 0;
    let connectedCount = 0;
    let answeredForDurationCount = 0;
    let answeredForPickCount = 0;

    snapshot.forEach((doc: any) => {
      const data = doc.data();
      const initiatedAt = data.initiatedAt?.toDate();
      const answeredAt = data.answeredAt?.toDate();
      const duration = data.duration || 0; // seconds

      if (data.disposition === 'ANSWERED' || answeredAt) {
        connectedCount++;
        if (duration > 0) {
          totalDuration += duration;
          answeredForDurationCount++;
        }
        if (initiatedAt && answeredAt) {
          const pickTime = (answeredAt.getTime() - initiatedAt.getTime()) / 1000;
          if (pickTime >= 0) {
            totalTimeToPick += pickTime;
            answeredForPickCount++;
          }
        }
      }
    });

    const totalAttempts = snapshot.size;

    return {
      avgCallDuration:
        answeredForDurationCount > 0
          ? parseFloat((totalDuration / answeredForDurationCount).toFixed(2))
          : 0,
      pickupResponse:
        answeredForPickCount > 0
          ? parseFloat((totalTimeToPick / answeredForPickCount).toFixed(2))
          : 0,
      connectedCalls: connectedCount,
      totalAttempts: totalAttempts,
    };
  } catch (error) {
    console.error('Error fetching call metrics:', error);
    return {
      avgCallDuration: 0,
      pickupResponse: 0,
      connectedCalls: 0,
      totalAttempts: 0,
    };
  }
}

export async function getHourlyCallActivity(
  companyId: string,
  startDate: Date,
  endDate: Date,
  agentId?: string,
): Promise<{ hour: string; attempts: number }[]> {
  const db = getIvrDb();
  if (!db) return [];

  try {
    const callsRef = db.collection('ivr').doc(companyId).collection('calls');
    let query = callsRef
      .where('initiatedAt', '>=', Timestamp.fromDate(startDate))
      .where('initiatedAt', '<', Timestamp.fromDate(endDate));

    if (agentId) {
      query = query.where('userId', '==', agentId);
    }

    const snapshot = await query.get();
    const hourlyStats: Record<number, number> = {};

    // Initialize office hours: 9 AM (9) to 7 PM (19)
    for (let i = 9; i < 19; i++) {
      hourlyStats[i] = 0;
    }

    snapshot.forEach((doc: any) => {
      const data = doc.data();
      const initiatedAt = data.initiatedAt?.toDate();
      if (initiatedAt) {
        // Adjust to IST for grouping
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(initiatedAt.getTime() + istOffset);
        const hour = istDate.getUTCHours();
        if (hour >= 9 && hour < 19) {
          hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
        }
      }
    });

    const format12h = (h: number) => {
      const displayHour = h % 12 || 12;
      return displayHour.toString().padStart(2, '0') + ':00';
    };

    return Object.keys(hourlyStats)
      .map(Number)
      .sort((a, b) => a - b)
      .map((h) => {
        const start = format12h(h);
        const end = format12h(h + 1);
        return {
          hour: `${start} - ${end}`,
          attempts: hourlyStats[h],
        };
      });
  } catch (error) {
    console.error('Error fetching hourly call activity:', error);
    return [];
  }
}

export async function getTodayCallMetrics(companyId: string): Promise<{
  avgCallDuration: number;
  pickupResponse: number;
  connectedCalls: number;
  totalAttempts: number;
}> {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const todayIST = new Date(Date.now() + istOffset);
  todayIST.setUTCHours(0, 0, 0, 0);
  const startOfTodayIST = new Date(todayIST.getTime() - istOffset);
  const endOfTodayIST = new Date(
    startOfTodayIST.getTime() + 24 * 60 * 60 * 1000,
  );
  return getCallMetrics(companyId, startOfTodayIST, endOfTodayIST);
}
