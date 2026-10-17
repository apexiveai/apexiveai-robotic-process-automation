
"""Hourly scheduler for Apexive AI Telecom RPA demo workflows."""

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from app.main import (
    SessionLocal,
    AutomationJob,
    execute_job_record,
    audit,
)

logger = logging.getLogger("apexive.hourly_scheduler")

MYANMAR_TZ = timezone(timedelta(hours=6, minutes=30))

scheduler = BackgroundScheduler(timezone=MYANMAR_TZ)


def run_hourly_cycle() -> None:
    """Run allow-listed demo checks and save their results."""

    db = SessionLocal()

    try:
        logger.info("Hourly monitoring cycle started")

        workflows = [
            ("KPI_REPORT", "Hourly PS/CS/VoLTE Core KPI Report"),
            ("KPI_CHECK", "Hourly Telecom KPI Check"),
            ("ANOMALY_SCAN", "Hourly Telecom Anomaly Scan"),
        ]

        for job_type, name in workflows:
            job = AutomationJob(
                name=name,
                job_type=job_type,
                status="QUEUED",
                scheduled_at=datetime.now(MYANMAR_TZ),
                result=None,
            )

            db.add(job)
            db.commit()
            db.refresh(job)

            audit(
                db,
                "JOB_CREATED",
                f"id={job.id}; type={job_type}; source=hourly_scheduler",
            )

            job_id = job.id

            try:
                current_job = db.get(AutomationJob, job_id)
                if current_job is None:
                    raise RuntimeError("Created job could not be reloaded")

                result = execute_job_record(db, current_job)

                logger.info(
                    "Hourly workflow completed: %s",
                    result,
                )

            except Exception:
                logger.exception(
                    "Hourly workflow failed: job_id=%s type=%s",
                    job_id,
                    job_type,
                )

        logger.info("Hourly monitoring cycle finished")

    except Exception:
        db.rollback()
        logger.exception("Hourly monitoring cycle failed")

    finally:
        db.close()


def start_scheduler() -> None:
    """Start one in-process scheduler."""

    if scheduler.running:
        logger.info("Hourly scheduler is already running")
        return

    scheduler.add_job(
        run_hourly_cycle,
        trigger="interval",
        hours=1,
        next_run_time=datetime.now(MYANMAR_TZ) + timedelta(seconds=15),
        id="apexive_hourly_monitoring",
        name="Apexive Telecom Hourly Monitoring",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300,
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Hourly scheduler started")


def stop_scheduler() -> None:
    """Stop the scheduler cleanly during application shutdown."""

    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Hourly scheduler stopped")
