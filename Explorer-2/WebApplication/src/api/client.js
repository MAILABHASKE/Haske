import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://haske.online:8090',
  timeout: 10000, // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

export default apiClient;