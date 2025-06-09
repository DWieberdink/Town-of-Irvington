"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, LabelList } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface BuildingUtilizationChartProps {
  capacity: number
  students: number
}

export default function BuildingUtilizationChart({ capacity, students }: BuildingUtilizationChartProps) {
  const chartData = [
    {
      name: "Utilization",
      students: students,
      capacity: capacity - students, // Remaining capacity
      totalCapacity: capacity,
    },
  ]

  const chartConfig = {
    students: {
      label: "Students",
      color: "hsl(var(--chart-1))", // Example: blue
    },
    capacity: {
      label: "Remaining Capacity",
      color: "hsl(var(--chart-2))", // Example: light gray or green
    },
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[80px] w-full max-w-[200px] mx-auto">
      {" "}
      {/* Reduced height */}
      <ResponsiveContainer width="100%" height={80}>
        <BarChart
          layout="vertical"
          data={chartData}
          stackOffset="expand" // This creates a 100% stacked bar effect
          margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
        >
          <CartesianGrid horizontal={false} vertical={false} />
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" hide />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, name, props) => {
                  if (name === "students") return [`${students.toLocaleString()} Students`, null]
                  if (name === "capacity")
                    return [
                      `${(capacity - students).toLocaleString()} Remaining Capacity (Total: ${capacity.toLocaleString()})`,
                      null,
                    ]
                  return [value, name]
                }}
              />
            }
          />
          <Bar dataKey="students" fill={chartConfig.students.color} stackId="a" radius={[4, 0, 0, 4]}>
            <LabelList
              dataKey="students"
              position="center"
              formatter={(value: number) => (capacity > 0 ? `${((value / capacity) * 100).toFixed(0)}%` : "0%")}
              className="fill-white font-semibold text-xs" // Made text smaller
            />
          </Bar>
          <Bar dataKey="capacity" fill={chartConfig.capacity.color} stackId="a" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
