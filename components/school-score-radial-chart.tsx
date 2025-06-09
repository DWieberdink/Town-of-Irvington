"use client"

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, type DotProps } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface SchoolScore {
  subject: string
  score: number
  fullMark: number
}

interface SchoolScoreRadialChartProps {
  data: SchoolScore[]
  previousData?: SchoolScore[]
}

const RADAR_CATEGORY_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6, 10 80% 50%))",
  "hsl(var(--chart-7, 200 80% 50%))",
]

export default function SchoolScoreRadialChart({ data, previousData }: SchoolScoreRadialChartProps) {
  const chartConfig = {
    score: {
      label: "Score",
      color: "hsl(var(--muted-foreground))",
    },
    previousScore: {
      label: "Previous Score",
      color: "hsl(var(--muted-foreground) / 0.5)",
    },
  }

  if (!data || data.length === 0) {
    return (
      <div className="mx-auto aspect-square max-h-[300px] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No data available for chart.</p>
      </div>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        {/* Restored outerRadius to 70% for a larger plot area */}
        <RadarChart data={data} outerRadius="70%">
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" labelKey="subject" />} />
          <PolarGrid />
          {/* Using default tick rendering with a specified font size */}
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8.5, fill: "#4A5568" }} />
          {previousData && previousData.length > 0 && (
            <Radar
              name={chartConfig.previousScore.label}
              dataKey="score"
              data={previousData}
              stroke={chartConfig.previousScore.color}
              strokeDasharray="4 4"
              fill="none"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          )}
          <Radar
            name="Current Score"
            dataKey="score"
            stroke="hsl(var(--border))"
            fill="hsl(var(--primary) / 0.1)"
            fillOpacity={1}
            dot={(props: DotProps & { payload?: SchoolScore; index?: number }) => {
              const { cx, cy, payload, index } = props
              if (typeof cx !== "number" || typeof cy !== "number" || index === undefined) {
                return null
              }
              const color = RADAR_CATEGORY_COLORS[index % RADAR_CATEGORY_COLORS.length]
              return <circle cx={cx} cy={cy} r={4} fill={color} stroke={color} />
            }}
            activeDot={{ r: 6 }}
            isAnimationActive={true}
          />
        </RadarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
