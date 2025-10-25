-- Migration: transfer patient helper function
-- Date: 2025-10-25

CREATE OR REPLACE FUNCTION public.transfer_patient_between_hospitals(
  _patient_id UUID,
  _target_hospital_id UUID,
  _notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _current_hospital UUID;
  _trimmed_notes TEXT := NULLIF(BTRIM(COALESCE(_notes, '')), '');
  _source_name TEXT;
BEGIN
  IF _patient_id IS NULL THEN
    RAISE EXCEPTION 'Patient id is required';
  END IF;

  IF _target_hospital_id IS NULL THEN
    RAISE EXCEPTION 'Target hospital id is required';
  END IF;

  _current_hospital := public.current_hospital_id();
  IF _current_hospital IS NULL THEN
    RAISE EXCEPTION 'Hospital assignment required for current user';
  END IF;

  IF _current_hospital = _target_hospital_id THEN
    RAISE EXCEPTION 'Cannot transfer to the same hospital';
  END IF;

  PERFORM 1
  FROM public.internal_report_patients p
  WHERE p.id = _patient_id
    AND p.receiving_hospital_id = _current_hospital
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient % not found for current hospital', _patient_id;
  END IF;

  INSERT INTO public.patient_status_history (
    internal_report_patient_id,
    hospital_id,
    status,
    notes,
    transfer_hospital_id
  )
  VALUES (
    _patient_id,
    _current_hospital,
    'transferred',
    _trimmed_notes,
    _target_hospital_id
  );

  UPDATE public.internal_report_patients
  SET receiving_hospital_id = _target_hospital_id,
      current_status = 'pending',
      current_status_notes = _trimmed_notes,
      current_transfer_hospital_id = NULL
  WHERE id = _patient_id;

  SELECT name
  INTO _source_name
  FROM public.hospitals
  WHERE id = _current_hospital;

  INSERT INTO public.patient_status_history (
    internal_report_patient_id,
    hospital_id,
    status,
    notes,
    transfer_hospital_id
  )
  VALUES (
    _patient_id,
    _target_hospital_id,
    'pending',
    COALESCE(
      _trimmed_notes,
      'Transferred from ' || COALESCE(_source_name, 'previous hospital')
    ),
    NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_patient_between_hospitals(UUID, UUID, TEXT) TO authenticated;
