import React from "react";
import { Link } from "react-router-dom";
import { EventType } from "../../types/EventType";

interface EventProps {
  event: EventType;
  onDelete: (id: number) => void;
}

const Event: React.FC<EventProps> = ({ event, onDelete }) => {
  return (
    <div>
      <h2>{event.title}</h2>
      <p>{event.description}</p>
      <p>Event Date: {new Date(event.event_datetime).toLocaleString()}</p>
      <p>Number of Attendees: {event.number_of_attendees}</p>
      <p>Created At: {new Date(event.created_at).toLocaleString()}</p>
      <p>Event status: {event.status}</p>
      <Link to={`/edit/${event.id}`}>Edit</Link>
      <button onClick={() => onDelete(event.id)}>Delete</button>
    </div>
  );
};

export default Event;
