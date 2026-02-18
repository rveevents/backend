const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// CORS sencillo
function withCors(handler) {
  return async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }
    return handler(req, res);
  };
}

// POST /reservar
exports.reservar = functions
  .region("europe-west1")
  .https.onRequest(
    withCors(async (req, res) => {
      if (req.method !== "POST") {
        return res.status(405).json({ ok: false, message: "Método no permitido" });
      }

      const { username, session, notes } = req.body || {};
      if (!username || !session) {
        return res
          .status(400)
          .json({ ok: false, message: "Faltan username o session" });
      }

      const cleanUsername = String(username).trim();
      const cleanSession = String(session).trim();

      const docRef = await db.collection("reservations").add({
        username: cleanUsername,
        session: cleanSession,
        notes: notes ? String(notes).trim() : "",
        redeemed: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({
        ok: true,
        id: docRef.id,
        message: "Reserva creada. Entra al juego para recibir tu objeto."
      });
    })
  );

// POST /claim
exports.claim = functions
  .region("europe-west1")
  .https.onRequest(
    withCors(async (req, res) => {
      if (req.method !== "POST") {
        return res.status(405).json({ ok: false, message: "Método no permitido" });
      }

      const { userId, username } = req.body || {};
      if (!userId || !username) {
        return res
          .status(400)
          .json({ ok: false, message: "Faltan userId o username" });
      }

      const cleanUsername = String(username).trim();

      const snap = await db
        .collection("reservations")
        .where("username", "==", cleanUsername)
        .where("redeemed", "==", false)
        .orderBy("createdAt", "asc")
        .limit(1)
        .get();

      if (snap.empty) {
        return res.json({ ok: false, message: "No hay reservas pendientes" });
      }

      const doc = snap.docs[0];
      const data = doc.data();

      await doc.ref.update({
        redeemed: true,
        redeemedAt: admin.firestore.FieldValue.serverTimestamp(),
        redeemedByUserId: userId
      });

      return res.json({
        ok: true,
        ticketType: data.session,
        reservationId: doc.id
      });
    })
  );

