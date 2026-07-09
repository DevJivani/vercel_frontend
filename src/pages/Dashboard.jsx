
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';

const Dashboard = () => {
  const [rooms, setRooms] = useState([]);
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/');
    } else {
      fetchRooms();
    }
  }, [user, navigate]);

  const fetchRooms = async () => {
    const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/rooms/user/${user._id}`);
    setRooms(data);
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/api/rooms/create`, { name: roomName, userId: user._id });
      navigate(`/room/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create room');
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/api/rooms/join`, { code: joinCode, userId: user._id });
      navigate(`/room/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join room');
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Welcome, {user?.username}!</h1>
        <button onClick={logout} className="btn btn-danger">
          Logout
        </button>
      </div>
      {error && <div className="error-message" style={{ maxWidth: '600px', margin: '0 auto 24px' }}>{error}</div>}

      <div className="room-actions">
        <form onSubmit={handleCreateRoom} className="card action-card">
          <h2 className="action-title">Create New Room</h2>
          <input
            type="text"
            placeholder="Enter room name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            required
            className="input-field"
            style={{ marginBottom: '20px' }}
          />
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            Create Room
          </button>
        </form>

        <form onSubmit={handleJoinRoom} className="card action-card">
          <h2 className="action-title">Join Existing Room</h2>
          <input
            type="text"
            placeholder="Enter room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            required
            className="input-field"
            style={{ marginBottom: '20px' }}
          />
          <button type="submit" className="btn btn-success" style={{ width: '100%' }}>
            Join Room
          </button>
        </form>
      </div>

      <div className="rooms-section">
        <h2 className="rooms-title">Your Rooms</h2>
        <div className="rooms-list">
          {rooms.map((room) => (
            <div
              key={room._id}
              onClick={() => navigate(`/room/${room._id}`)}
              className="card room-card"
            >
              <h3 className="room-name">{room.name}</h3>
              <p className="room-code">Code: {room.code}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
