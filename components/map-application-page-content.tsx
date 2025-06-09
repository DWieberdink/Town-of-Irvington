"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import mapboxgl from "mapbox-gl"
import MapboxDraw from "@mapbox/mapbox-gl-draw"
import type { Feature, Polygon } from "geojson"
import * as turf from "@turf/turf"

import "mapbox-gl/dist/mapbox-gl.css"
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import BuildingUtilizationChart from "./building-utilization-chart"
import SchoolScoreRadialChart from "./school-score-radial-chart"
import { PieChart, Pie, Cell, Legend, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts" // Aliased Tooltip to avoid conflict if any
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"

const MAPBOX_TOKEN = "pk.eyJ1IjoicGF0d2QwNSIsImEiOiJjbTZ2bGVhajIwMTlvMnFwc2owa3BxZHRoIn0.moDNfqMUolnHphdwsIF87w"
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN
} else {
  console.error("Mapbox token is not set. Please provide a valid token.")
}

const INITIAL_CAPACITY = 500
const INITIAL_STUDENTS = 490
const SQFT_PER_CAPACITY_UNIT = 2000
const SEATS_PER_CAPACITY_UNIT = 24
const FEET_PER_STORY = 12
const METERS_PER_FOOT = 0.3048
const COST_PER_SQFT = 1200 // Added for capital cost calculation

const BUILDING_TYPE_COLORS: { [key: string]: string } = {
  "Classroom Addition": "#3B82F6",
  Gym: "#10B981",
  Cafeteria: "#F59E0B",
  Auditorium: "#8B5CF6", // Changed from Theater to Auditorium
  Default: "#6B7280",
}

const PIE_CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))"]

interface SchoolScore {
  subject: string
  score: number
  fullMark: number
}

interface DrawnFeatureProperties {
  id: string
  buildingType: string
  stories: number
  baseAreaSqFt: number
  color: string
  height: number
}

type AppFeature = Feature<Polygon, DrawnFeatureProperties>

const INITIAL_SCHOOL_SCORES: SchoolScore[] = [
  { subject: "Classrooms", score: 56, fullMark: 100 },
  { subject: "Ext. Learning", score: 60, fullMark: 100 },
  { subject: "Safety/Security", score: 90, fullMark: 100 },
  { subject: "Organization", score: 75, fullMark: 100 },
  { subject: "Assembly", score: 34, fullMark: 100 },
  { subject: "Community", score: 60, fullMark: 100 }, // Corrected subject name from "Comm"
  { subject: "Presence", score: 65, fullMark: 100 },
]

export default function MapApplicationPageContent() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const drawRef = useRef<MapboxDraw | null>(null)

  const [currentBuildingType, setCurrentBuildingType] = useState<string>("Classroom Addition")
  const [currentStories, setCurrentStories] = useState<number>(1)

  const [drawnFeatures, setDrawnFeatures] = useState<AppFeature[]>([])

  const [totalBuildingAreaSqFt, setTotalBuildingAreaSqFt] = useState<number>(0)
  const [totalClassroomAreaSqFt, setTotalClassroomAreaSqFt] = useState<number>(0)

  const [capacity, setCapacity] = useState<number>(INITIAL_CAPACITY)
  const [students] = useState<number>(INITIAL_STUDENTS)

  const [schoolScoresData, setSchoolScoresData] = useState<SchoolScore[]>(INITIAL_SCHOOL_SCORES)
  const [previousSchoolScoresData, setPreviousSchoolScoresData] = useState<SchoolScore[]>(INITIAL_SCHOOL_SCORES)

  const updateMapAndCalculations = useCallback(() => {
    let newTotalBuildingArea = 0
    let newTotalClassroomArea = 0

    const featuresForMap = drawnFeatures.map((feature) => {
      const stories = Number(feature.properties.stories) || 1
      const baseAreaSqFt = Number(feature.properties.baseAreaSqFt) || 0
      const featureTotalArea = baseAreaSqFt * stories
      newTotalBuildingArea += featureTotalArea

      if (feature.properties.buildingType === "Classroom Addition") {
        newTotalClassroomArea += featureTotalArea
      }

      return {
        ...feature,
        properties: {
          ...feature.properties,
          stories: stories,
          baseAreaSqFt: baseAreaSqFt,
          height: stories * FEET_PER_STORY * METERS_PER_FOOT,
          color: BUILDING_TYPE_COLORS[feature.properties.buildingType] || BUILDING_TYPE_COLORS["Default"],
        },
      }
    })

    setTotalBuildingAreaSqFt(newTotalBuildingArea)
    setTotalClassroomAreaSqFt(newTotalClassroomArea)

    if (mapRef.current?.getSource("drawn-polygons-source") && mapRef.current.isStyleLoaded()) {
      ;(mapRef.current.getSource("drawn-polygons-source") as mapboxgl.GeoJSONSource).setData({
        type: "FeatureCollection",
        features: featuresForMap,
      })
    }
  }, [drawnFeatures])

  const updateSchoolScores = useCallback(() => {
    setPreviousSchoolScoresData((currentScores) => currentScores)

    const baseScores = {
      Classrooms: INITIAL_SCHOOL_SCORES.find((s) => s.subject === "Classrooms")!.score,
      Assembly: INITIAL_SCHOOL_SCORES.find((s) => s.subject === "Assembly")!.score,
      "Ext. Learning": INITIAL_SCHOOL_SCORES.find((s) => s.subject === "Ext. Learning")!.score,
      Community: INITIAL_SCHOOL_SCORES.find((s) => s.subject === "Community")!.score,
    }

    let calculatedClassroomScore = baseScores.Classrooms
    let calculatedAssemblyScore = baseScores.Assembly
    let calculatedExtLearningScore = baseScores["Ext. Learning"]
    let calculatedCommunityScore = baseScores.Community

    let totalClassroomAreaForScore = 0
    let hasQualifyingAssemblySpace = false
    let hasQualifyingCommunitySpace = false // New flag for community space
    let totalBaseLevelAreaForScore = 0

    drawnFeatures.forEach((feature) => {
      const stories = Number(feature.properties.stories) || 1
      const baseAreaSqFt = Number(feature.properties.baseAreaSqFt) || 0
      const totalArea = baseAreaSqFt * stories

      if (feature.properties.buildingType === "Classroom Addition") {
        totalClassroomAreaForScore += totalArea
      }

      const assemblyBuildingTypes = ["Gym", "Cafeteria", "Auditorium"]
      if (assemblyBuildingTypes.includes(feature.properties.buildingType) && totalArea >= 5000) {
        hasQualifyingAssemblySpace = true
        hasQualifyingCommunitySpace = true // If it qualifies for assembly, it also qualifies for community bonus
      }
      totalBaseLevelAreaForScore += baseAreaSqFt
    })

    const classroomBonusUnits = Math.floor(totalClassroomAreaForScore / 2000)
    calculatedClassroomScore += classroomBonusUnits * 1 // Changed from 2 to 1 as per previous request

    if (hasQualifyingAssemblySpace) {
      calculatedAssemblyScore = baseScores.Assembly + 25
    }

    if (hasQualifyingCommunitySpace) {
      // Apply community bonus
      calculatedCommunityScore = baseScores.Community + 15
    }

    const extLearningPenaltyUnits = Math.floor(totalBaseLevelAreaForScore / 5000)
    calculatedExtLearningScore -= extLearningPenaltyUnits * 7 // Changed from 8 to 7 as per previous request

    setSchoolScoresData(() =>
      INITIAL_SCHOOL_SCORES.map((initialScoreItem) => {
        if (initialScoreItem.subject === "Classrooms") {
          return { ...initialScoreItem, score: Math.max(0, Math.min(100, calculatedClassroomScore)) }
        }
        if (initialScoreItem.subject === "Assembly") {
          return { ...initialScoreItem, score: Math.max(0, Math.min(100, calculatedAssemblyScore)) }
        }
        if (initialScoreItem.subject === "Ext. Learning") {
          return { ...initialScoreItem, score: Math.max(0, Math.min(100, calculatedExtLearningScore)) }
        }
        if (initialScoreItem.subject === "Community") {
          // Update Community score
          return { ...initialScoreItem, score: Math.max(0, Math.min(100, calculatedCommunityScore)) }
        }
        return initialScoreItem
      }),
    )
  }, [drawnFeatures])

  useEffect(() => {
    updateMapAndCalculations()
    updateSchoolScores()
  }, [updateMapAndCalculations, updateSchoolScores])

  useEffect(() => {
    let newCapacity = INITIAL_CAPACITY
    if (totalClassroomAreaSqFt > 0) {
      const additionalCapacityUnits = Math.floor(totalClassroomAreaSqFt / SQFT_PER_CAPACITY_UNIT)
      newCapacity = INITIAL_CAPACITY + additionalCapacityUnits * SEATS_PER_CAPACITY_UNIT
    }
    setCapacity(newCapacity)
  }, [totalClassroomAreaSqFt])

  const handleDrawCreate = useCallback(
    (e: { features: Feature<Polygon>[] }) => {
      const newFeaturesToAdd: AppFeature[] = e.features.map((feature) => {
        const areaM2 = turf.area(feature.geometry)
        const areaFt = areaM2 * 10.7639
        const stories = Number(currentStories) || 1

        return {
          ...feature,
          properties: {
            id: feature.id as string,
            buildingType: currentBuildingType,
            stories: stories,
            baseAreaSqFt: areaFt,
            color: BUILDING_TYPE_COLORS[currentBuildingType] || BUILDING_TYPE_COLORS["Default"],
            height: stories * FEET_PER_STORY * METERS_PER_FOOT,
          },
        } as AppFeature
      })
      setDrawnFeatures((prev) => [...prev, ...newFeaturesToAdd])

      setTimeout(() => {
        if (drawRef.current) {
          drawRef.current.changeMode("draw_polygon")
        }
      }, 0)
    },
    [currentBuildingType, currentStories],
  )

  const handleDrawUpdate = useCallback((e: { features: Feature<Polygon>[]; action: string }) => {
    setDrawnFeatures((prevFeatures) =>
      prevFeatures.map((df) => {
        const updatedFeature = e.features.find((uf) => uf.id === df.id)
        if (updatedFeature) {
          const areaM2 = turf.area(updatedFeature.geometry)
          const areaFt = areaM2 * 10.7639
          return {
            ...df,
            geometry: updatedFeature.geometry,
            properties: {
              ...df.properties,
              baseAreaSqFt: areaFt,
            },
          }
        }
        return df
      }),
    )
  }, [])

  const handleDrawDelete = useCallback((e: { features: Feature<Polygon>[] }) => {
    const deletedIds = e.features.map((f) => f.id)
    setDrawnFeatures((prev) => prev.filter((df) => !deletedIds.includes(df.id)))
  }, [])

  const handleDrawCreateRef = useRef(handleDrawCreate)
  const handleDrawUpdateRef = useRef(handleDrawUpdate)
  const handleDrawDeleteRef = useRef(handleDrawDelete)

  useEffect(() => {
    handleDrawCreateRef.current = handleDrawCreate
  }, [handleDrawCreate])

  useEffect(() => {
    handleDrawUpdateRef.current = handleDrawUpdate
  }, [handleDrawUpdate])

  useEffect(() => {
    handleDrawDeleteRef.current = handleDrawDelete
  }, [handleDrawDelete])

  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      alert("Mapbox token is not configured. The map will not load.")
      return
    }
    if (mapRef.current || !mapContainerRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/satellite-v9",
      center: [-77.15755727817181, 38.80202601637935],
      zoom: 16,
      pitch: 45,
    })
    mapRef.current = map

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: "draw_polygon",
    })
    drawRef.current = draw
    map.addControl(draw)

    map.on("load", () => {
      map.addSource("drawn-polygons-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      })
      map.addLayer({
        id: "polygon-extrusion-layer",
        type: "fill-extrusion",
        source: "drawn-polygons-source",
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.75,
        },
      })
      updateMapAndCalculations()
      updateSchoolScores()
    })

    const onDrawCreate = (e: mapboxgl.MapboxEvent<any> & mapboxgl.EventData) =>
      handleDrawCreateRef.current(e as { features: Feature<Polygon>[] })
    const onDrawUpdate = (e: mapboxgl.MapboxEvent<any> & mapboxgl.EventData) =>
      handleDrawUpdateRef.current(e as { features: Feature<Polygon>[]; action: string })
    const onDrawDelete = (e: mapboxgl.MapboxEvent<any> & mapboxgl.EventData) =>
      handleDrawDeleteRef.current(e as { features: Feature<Polygon>[] })

    map.on("draw.create", onDrawCreate)
    map.on("draw.update", onDrawUpdate)
    map.on("draw.delete", onDrawDelete)

    return () => {
      map.off("draw.create", onDrawCreate)
      map.off("draw.update", onDrawUpdate)
      map.off("draw.delete", onDrawDelete)
      map.remove()
      mapRef.current = null
    }
  }, [])

  const utilizationPercentage = capacity > 0 ? (students / capacity) * 100 : 0
  const capitalCost = totalBuildingAreaSqFt * COST_PER_SQFT

  const hardCosts = capitalCost * 0.7
  const softCosts = capitalCost * 0.3

  const costBreakdownData = [
    { name: "Hard Costs (70%)", value: hardCosts, fill: PIE_CHART_COLORS[0] },
    { name: "Soft Costs (30%)", value: softCosts, fill: PIE_CHART_COLORS[1] },
  ]

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      <Card className="w-full max-w-sm lg:max-w-md m-4 shadow-xl rounded-lg overflow-y-auto">
        <CardHeader className="sticky top-0 bg-white dark:bg-gray-800 z-10 border-b">
          <CardTitle>Fairfax Site Planning Tool</CardTitle>
          <CardDescription>Plan new building sections. Properties apply to the next drawing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-3 md:p-4">
          <div className="space-y-2">
            <Label htmlFor="building-type">Building Type (for next drawing)</Label>
            <Select value={currentBuildingType} onValueChange={setCurrentBuildingType}>
              <SelectTrigger id="building-type" className="text-sm">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Classroom Addition">Classroom Addition</SelectItem>
                <SelectItem value="Gym">Gym</SelectItem>
                <SelectItem value="Cafeteria">Cafeteria</SelectItem>
                <SelectItem value="Auditorium">Auditorium</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stories">Number of Stories (for next drawing)</Label>
            <Input
              id="stories"
              type="number"
              min="1"
              value={currentStories}
              onChange={(e) => setCurrentStories(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
              className="w-full text-sm"
            />
          </div>
          <div className="space-y-2 border-t pt-4">
            <Label className="text-base font-semibold">Project Summary</Label>
            <p>
              Total Building Area:{" "}
              <span className="font-bold">
                {totalBuildingAreaSqFt.toLocaleString(undefined, { maximumFractionDigits: 0 })} sqft
              </span>
            </p>
            <p>
              Total Classroom Area:{" "}
              <span className="font-bold">
                {totalClassroomAreaSqFt.toLocaleString(undefined, { maximumFractionDigits: 0 })} sqft
              </span>
            </p>
            <p className="text-xs text-muted-foreground">(Used for capacity calculation)</p>
          </div>

          {/* Modified Section for Utilization and Capital Cost */}
          <div className="border-t pt-4">
            <div className="flex flex-row gap-4">
              {/* Left Column: Building Utilization */}
              <div className="w-1/2 space-y-2">
                <Label className="text-base font-semibold">Building Utilization</Label>
                <div className="text-center">
                  <p className="text-lg">
                    <span className="font-bold">{students.toLocaleString()}</span> /{" "}
                    <span className="font-bold">{capacity.toLocaleString()}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Students / Capacity</p>
                  <p className="text-sm text-muted-foreground">({utilizationPercentage.toFixed(1)}% Utilized)</p>
                </div>
                <div className="max-w-xs mx-auto">
                  <BuildingUtilizationChart capacity={capacity} students={students} />
                </div>
              </div>

              {/* Right Column: Capital Cost */}
              <div className="w-1/2 space-y-3 border-l pl-4">
                <Label className="text-base font-semibold">Capital Cost</Label>
                <div className="text-center">
                  <p className="text-lg font-bold">
                    {capitalCost.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">Est. at ${COST_PER_SQFT.toLocaleString()}/sqft</p>
                  <p className="text-xs text-muted-foreground">
                    Total Area: {totalBuildingAreaSqFt.toLocaleString(undefined, { maximumFractionDigits: 0 })} sqft
                  </p>
                </div>
                {capitalCost > 0 && (
                  <ChartContainer
                    config={{
                      hardCosts: { label: "Hard Costs", color: PIE_CHART_COLORS[0] },
                      softCosts: { label: "Soft Costs", color: PIE_CHART_COLORS[1] },
                    }}
                    className="mx-auto aspect-square max-h-[180px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <RechartsTooltip
                          cursor={false}
                          content={
                            <ChartTooltipContent
                              hideLabel
                              formatter={(value, name, props) => (
                                <>
                                  <span
                                    className="ui-mr-2 ui-h-2.5 ui-w-2.5 ui-shrink-0 ui-rounded-sm"
                                    style={{ backgroundColor: props.payload.fill }}
                                  />
                                  {props.payload.name}:{" "}
                                  {Number(value).toLocaleString("en-US", {
                                    style: "currency",
                                    currency: "USD",
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  })}
                                </>
                              )}
                            />
                          }
                        />
                        <Pie
                          data={costBreakdownData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={60}
                          labelLine={false}
                        >
                          {costBreakdownData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Legend
                          layout="horizontal"
                          verticalAlign="bottom"
                          align="center"
                          iconSize={10}
                          wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label className="text-base font-semibold">Educational Adequacy Scores</Label>
            <SchoolScoreRadialChart data={schoolScoresData} previousData={previousSchoolScoresData} />
          </div>
        </CardContent>
      </Card>
      <div className="relative flex-1 h-full">
        <div ref={mapContainerRef} className="w-full h-full" />
        {/* Logo overlay */}
        <div className="absolute bottom-4 left-4 z-10">
          <img
            src="/images/logo-perkins-eastman.png"
            alt="Perkins Eastman"
            className="h-8 w-auto opacity-90 drop-shadow-lg"
            style={{
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
              mixBlendMode: "multiply",
            }}
          />
        </div>
      </div>
    </div>
  )
}
