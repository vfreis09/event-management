import { Request, Response } from "express";
const pool = require("../config/dbConfig");

const createEvent = async (req: Request, res: Response) => {
  if (!req.session.user) {
    return res.status(401).send("Unauthorized");
  }
  const { title, description, eventDateTime, location, max_attendees } =
    req.body;

  if (!location) {
    return res.status(400).json({ message: "Location is required." });
  }

  const [longitude, latitude] = location.split(" ").map(Number);
  if (isNaN(longitude) || isNaN(latitude)) {
    return res.status(400).json({ message: "Invalid location format." });
  }

  const locationPoint = `(${longitude}, ${latitude})`;

  const authorId = req.session.user.id;

  try {
    const result = await pool.query(
      "INSERT INTO events (title, description, event_datetime, location, author_id, max_attendees) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [
        title,
        description,
        eventDateTime,
        locationPoint,
        authorId,
        max_attendees,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getEvents = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM events ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getEventById = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  try {
    const result = await pool.query(
      `SELECT * 
       FROM events
       WHERE events.id = $1`,
      [id]
    );

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ message: "Event not found" });
    }
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateEvent = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { title, description, eventDateTime, location } = req.body;

  if (!location) {
    return res.status(400).json({ message: "Location is required." });
  }

  const [longitude, latitude] = location.split(" ").map(Number);
  if (isNaN(longitude) || isNaN(latitude)) {
    return res.status(400).json({ message: "Invalid location format." });
  }

  const locationPoint = `(${longitude}, ${latitude})`;

  const authorId = req.session.user.id;
  try {
    const result = await pool.query(
      "UPDATE events SET title = $1, description = $2, event_datetime = $3, location = $4 WHERE id = $5 AND author_id = $6 RETURNING *",
      [title, description, eventDateTime, locationPoint, id, authorId]
    );
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ message: "Post not found or not authorized" });
    }
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteEvent = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const authorId = req.session.user.id;
  try {
    const result = await pool.query(
      "DELETE FROM events WHERE id = $1 AND author_id = $2 RETURNING *",
      [id, authorId]
    );
    if (result.rows.length > 0) {
      res.json({ message: "Event deleted successfully" });
    } else {
      res.status(404).json({ message: "Event not found or not authorized" });
    }
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

//rsvp

const createRsvp = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { userId, status } = req.body;

  try {
    // Check if event exists
    const event = await pool.query("SELECT * FROM events WHERE id = $1", [id]);
    if (!event.rows.length) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    const { max_attendees } = event.rows[0];

    const updateAttendeesCount = async (id: string): Promise<number> => {
      const result = await pool.query(
        `SELECT COUNT(*) FROM rsvps WHERE event_id = $1 AND status = 'Accepted'`,
        [id]
      );
      const attendeesCount = parseInt(result.rows[0].count, 10);

      await pool.query(
        `UPDATE events SET number_of_attendees = $1 WHERE id = $2`,
        [attendeesCount, id]
      );

      return attendeesCount;
    };

    // Check max attendees limit if RSVP is "Accepted"
    if (status === "Accepted" && max_attendees !== null) {
      const currentAttendees = await updateAttendeesCount(id);
      if (currentAttendees >= max_attendees) {
        res
          .status(400)
          .json({ message: "Maximum number of attendees reached" });
        return;
      }
    }

    // Add or update RSVP
    await pool.query(
      `INSERT INTO rsvps (user_id, event_id, status)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, event_id) 
         DO UPDATE SET status = EXCLUDED.status`,
      [userId, id, status]
    );

    await updateAttendeesCount(id);

    res.status(200).json({ message: "RSVP updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const getRsvps = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const rsvps = await pool.query(
      `SELECT u.name, r.status FROM rsvps r
         JOIN users u ON r.user_id = u.id
         WHERE r.event_id = $1`,
      [id]
    );

    res.status(200).json(rsvps.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const getSingleRsvp = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const rsvp = await pool.query(
      `SELECT status FROM rsvps WHERE event_id = $1 AND user_id = $2`,
      [id, userId]
    );

    const event = await pool.query(
      `SELECT COUNT(*) AS attendee_count, max_attendees 
       FROM rsvps 
       INNER JOIN events ON rsvps.event_id = events.id
       WHERE events.id = $1
       GROUP BY max_attendees`,
      [id]
    );

    if (!event.rows.length) {
      return res.status(404).json({ message: "Event not found" });
    }

    const { attendee_count, max_attendees } = event.rows[0];
    const isEventFull = attendee_count >= max_attendees;

    if (!rsvp.rows.length) {
      return res.status(404).json({
        message: "RSVP not found",
        isEventFull,
      });
    }

    res.status(200).json({
      status: rsvp.rows[0].status,
      isEventFull,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const eventController = {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  createRsvp,
  getRsvps,
  getSingleRsvp,
};

export default eventController;
