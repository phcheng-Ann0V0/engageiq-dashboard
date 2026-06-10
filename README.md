# Engagement Opportunity Dashboard

Start the interface:

```bash
cd "dashboard code"
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

The dashboard ships with representative data so every interaction can be
reviewed immediately. To replace it with collected pipeline data:

```bash
python3 prepare_dashboard_data.py ../unified_opportunities.parquet
```

To run without GitHub or Reddit API access, load either bundled offline
snapshot:

```bash
python3 prepare_dashboard_data.py ../offline_snapshot/engagement_opportunities_5000.csv
python3 prepare_dashboard_data.py ../offline_snapshot/engagement_opportunities_5000.sqlite
```

Interests and feedback are saved locally in the browser and used to rerank
recommendations. Engage/skip/bookmark feedback updates a lightweight
contextual-bandit ranking learner. The restart button clears interests,
feedback, and the learned ranking weights. The weekly
brief can be downloaded as CSV or printed/saved as PDF using the browser print
dialog.
