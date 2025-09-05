'use client';

import React, { useState, useEffect } from 'react';
import type { AppSettings } from '../types';

interface BroadcastPageProps {
  goToDashboard: () => void;
  settings: AppSettings;
}

const BroadcastPage: React.FC<BroadcastPageProps> = ({ goToDashboard, settings }) => {
  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState('');
  const [type, setType] = useState('sms'); // 'sms' or 'whatsapp'
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('Sending...');

    const recipientList = recipients.split(',').map(r => r.trim()).filter(r => r);

    if (recipientList.length === 0) {
      setStatus('Please enter at least one recipient.');
      return;
    }

    try {
      if (window.electronAPI) {
        const data = await window.electronAPI.sendTwilioMessage({
          message,
          recipients: recipientList,
          type,
        });

        if (data.success) {
          setStatus('Messages sent successfully!');
          setMessage('');
          setRecipients('');
        } else {
          setStatus(`Error: ${data.error}`);
        }
      } else {
        setStatus('Error: Messaging is only available in the desktop application.');
        console.error('Electron API is not available.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setStatus(`Error: ${errorMessage}`);
      console.error('Failed to send message via Electron IPC:', error);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Broadcast Messages</h1>
      <button type="button" onClick={goToDashboard} style={{ marginBottom: 16 }}>
        ← Back to Dashboard
      </button>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700">Message</label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Enter your message here..."
            required
          />
        </div>
        <div>
          <label htmlFor="recipients" className="block text-sm font-medium text-gray-700">Recipients</label>
          <input
            type="text"
            id="recipients"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Enter phone numbers, comma-separated (e.g., +1234567890, +10987654321)"
            required
          />
          <p className="mt-2 text-sm text-gray-500">For WhatsApp, include country code (e.g., +14155238886). For SMS, use the format your provider requires.</p>
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-gray-700">Message Type</legend>
          <div className="mt-2 space-x-4">
            <label>
              <input
                type="radio"
                value="sms"
                checked={type === 'sms'}
                onChange={() => setType('sms')}
                className="mr-1"
              />
              SMS
            </label>
            <label>
              <input
                type="radio"
                value="whatsapp"
                checked={type === 'whatsapp'}
                onChange={() => setType('whatsapp')}
                className="mr-1"
              />
              WhatsApp
            </label>
          </div>
        </fieldset>
        <button
          type="submit"
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Send Messages
        </button>
      </form>
      {status && <p className="mt-4 text-sm text-gray-600">{status}</p>}
    </div>
  );
};

export default BroadcastPage;
