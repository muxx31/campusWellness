import React, {
  useEffect,
  useState,
} from "react";

import axios from "axios";
import BACKEND_URL from "../config";

const BookingForm = ({
  onBookingSuccess,
}) => {
  const [counselors, setCounselors] =
    useState([]);

  const [form, setForm] = useState({
    counselorId: "",
    date: "",
    time: "",
    issue: "",
  });

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // Fetch counselors
  useEffect(() => {
    const fetchCounselors =
      async () => {
        try {
          const res =
            await axios.get(
              `${BACKEND_URL}/api/counselorAuth/list`
            );

          setCounselors(
            res.data
          );
        } catch (err) {
          console.error(
            "Error fetching counselors:",
            err
          );

          setError(
            "Could not load counselors"
          );
        } finally {
          setLoading(false);
        }
      };

    fetchCounselors();
  }, []);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]:
        e.target.value,
    });
  };

  const handleSubmit = async (
    e
  ) => {
    e.preventDefault();

    try {
      const token =
        localStorage.getItem(
          "token"
        );

      if (!token) {
        alert(
          "Please login first"
        );
        return;
      }

      if (!form.counselorId) {
        alert(
          "Please select a counselor"
        );
        return;
      }

      await axios.post(
        `${BACKEND_URL}/api/book`,
        form,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      if (onBookingSuccess) {
        onBookingSuccess();
      }

      setForm({
        counselorId: "",
        date: "",
        time: "",
        issue: "",
      });
    } catch (err) {
      console.error(
        "Booking error:",
        err.response?.data ||
          err.message
      );

      alert(
        err.response?.data
          ?.error ||
          err.response?.data
          ?.message ||
          "❌ Booking failed"
      );
    }
  };

  return (
    <div className="bg-gradient-to-r from-gray-800 to-gray-500 p-6 rounded-xl shadow-md max-w-xl mx-auto">

      <h2 className="text-xl font-semibold mb-4 text-center">
        Book Anonymous Counseling
      </h2>

      {error && (
        <p className="text-red-400 text-center mb-3">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-3"
      >

        {/* Counselor */}
        <select
          name="counselorId"
          value={form.counselorId}
          onChange={handleChange}
          required
          disabled={loading}
          className="w-full border px-3 py-2 rounded"
        >
          <option value="">
            {loading
              ? "Loading counselors..."
              : "Select Counselor"}
          </option>

          {counselors.map(
            (counselor) => (
              <option
                key={counselor._id}
                value={counselor._id}
              >
                {counselor.name}
              </option>
            )
          )}
        </select>

        {/* Date */}
        <input
          type="date"
          name="date"
          value={form.date}
          onChange={handleChange}
          required
          className="w-full border px-3 py-2 rounded"
        />

        {/* Time */}
        <input
          type="time"
          name="time"
          value={form.time}
          onChange={handleChange}
          required
          className="w-full border px-3 py-2 rounded"
        />

        {/* Issue */}
        <textarea
          name="issue"
          placeholder="Optional: Describe your issue"
          value={form.issue}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-700 disabled:bg-gray-500"
        >
          Book Session
        </button>

      </form>
    </div>
  );
};

export default BookingForm;