import { useState, useEffect, useCallback } from "react"
import { CapacitorGeolocation, type LocationCoords } from "@/lib/capacitor-geolocation"

export type LocationPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown' | string

interface UseErTeamLocationResult {
  userLocation: LocationCoords | null
  locationPermission: LocationPermissionStatus
  locationError: string | null
  isGettingLocation: boolean
  requestLocation: () => Promise<void>
  checkLocationPermission: () => Promise<void>
  openGoogleMapsDirections: (destination: { lat: number; lng: number }) => void
}

export function useErTeamLocation(): UseErTeamLocationResult {
  const [userLocation, setUserLocation] = useState<LocationCoords | null>(null)
  const [locationPermission, setLocationPermission] = useState<LocationPermissionStatus>('unknown')
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  const checkLocationPermission = useCallback(async () => {
    try {
      const result = await CapacitorGeolocation.checkPermissions()
      setLocationPermission(result.location)
    } catch (error) {
      console.warn('Permission API not supported:', error)
      setLocationPermission('unknown')
    }
  }, [])

  const requestLocation = useCallback(async () => {
    setIsGettingLocation(true)
    setLocationError(null)

    try {
      const coords = await CapacitorGeolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      })

      setUserLocation(coords)
      setLocationPermission('granted')
      console.log('ER Team location obtained:', coords)
    } catch (error: any) {
      console.error('Failed to get location:', error)
      let errorMessage = 'Failed to get your location'

      if (error.code === 1) {
        errorMessage = 'Location permission denied. Please enable location access.'
        setLocationPermission('denied')
      } else if (error.code === 2) {
        errorMessage = 'Location information is unavailable'
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out'
      }

      setLocationError(errorMessage)
    } finally {
      setIsGettingLocation(false)
    }
  }, [])

  const openGoogleMapsDirections = useCallback((destination: { lat: number; lng: number }) => {
    if (!userLocation) {
      setLocationError('Your location is not available. Please get your location first.')
      return
    }

    const origin = `${userLocation.lat},${userLocation.lng}`
    const dest = `${destination.lat},${destination.lng}`
    const mapsUrl = `https://www.google.com/maps/dir/${origin}/${dest}/@${userLocation.lat},${userLocation.lng},15z`

    window.open(mapsUrl, '_blank', 'noopener,noreferrer')
  }, [userLocation])

  // Auto-request location on mount and periodically update
  useEffect(() => {
    const autoRequestLocation = async () => {
      if (userLocation || locationPermission === 'denied' || locationPermission === 'unknown') {
        return
      }

      console.log('🌍 Auto-requesting ER team location...')
      await requestLocation()
    }

    void checkLocationPermission().then(() => {
      void autoRequestLocation()
    })

    // Set up periodic location updates (every 1 minute)
    const locationInterval = setInterval(() => {
      if (locationPermission === 'granted' && navigator.onLine) {
        console.log('🔄 Periodic location update for ER team')
        void requestLocation()
      }
    }, 1 * 60 * 1000) // 1 minute

    return () => {
      clearInterval(locationInterval)
    }
  }, [userLocation, locationPermission, checkLocationPermission, requestLocation])

  return {
    userLocation,
    locationPermission,
    locationError,
    isGettingLocation,
    requestLocation,
    checkLocationPermission,
    openGoogleMapsDirections,
  }
}
