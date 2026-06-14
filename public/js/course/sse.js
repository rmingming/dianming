// ── SSE: real-time updates from server ──
// Depends on: window.COURSE_ID, addCheckinRow(), removeCheckinRow(), updateGrid(), updateStats()

(function() {
  const evtSource = new EventSource('/api/sse/course/' + window.COURSE_ID);
  evtSource.addEventListener('update', function(e) {
    const data = JSON.parse(e.data);
    if (data.type === 'checkin') {
      addCheckinRow(data.checkin);
    } else if (data.type === 'reset') {
      removeCheckinRow(data.checkinId);
    } else if (data.type === 'reset-all') {
      location.reload();
      return;
    }
    updateGrid();
    updateStats();
  });
  evtSource.addEventListener('connected', function() {});
})();
