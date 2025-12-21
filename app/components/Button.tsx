// Tremor Button [v1.0.0]
// Updated to use semantic color tokens for dark/light mode support

import React from "react"
import { Slot } from "@radix-ui/react-slot"
import { RiLoader2Fill } from "@remixicon/react"
import { tv, type VariantProps } from "tailwind-variants"

import { cx, focusRing } from "../lib/utils"

const buttonVariants = tv({
  base: [
    // base
    "relative inline-flex items-center justify-center whitespace-nowrap rounded-md border px-3 py-2 text-center text-sm font-medium shadow-xs transition-all duration-100 ease-in-out cursor-pointer",
    // disabled
    "disabled:pointer-events-none disabled:shadow-none",
    // focus
    focusRing,
  ],
  variants: {
    variant: {
      primary: [
        // border
        "border-transparent",
        // text color
        "text-text-inverted",
        // background color
        "bg-accent",
        // hover color
        "hover:bg-accent-hover",
        // disabled
        "disabled:opacity-50",
      ],
      secondary: [
        // border
        "border-border-strong",
        // text color
        "text-text-primary",
        // background color
        "bg-bg-surface",
        //hover color
        "hover:bg-bg-elevated",
        // disabled
        "disabled:opacity-50",
      ],
      light: [
        // base
        "shadow-none",
        // border
        "border-transparent",
        // text color
        "text-text-primary",
        // background color
        "bg-bg-elevated",
        // hover color
        "hover:bg-bg-muted",
        // disabled
        "disabled:opacity-50",
      ],
      ghost: [
        // base
        "shadow-none",
        // border
        "border-transparent",
        // text color
        "text-text-primary",
        // hover color
        "bg-transparent hover:bg-bg-elevated",
        // disabled
        "disabled:opacity-50",
      ],
      destructive: [
        // text color
        "text-text-inverted",
        // border
        "border-transparent",
        // background color
        "bg-destructive",
        // hover color
        "hover:bg-destructive-hover",
        // disabled
        "disabled:opacity-50",
      ],
    },
  },
  defaultVariants: {
    variant: "primary",
  },
})

interface ButtonProps
  extends React.ComponentPropsWithoutRef<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
  loadingText?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      asChild,
      isLoading = false,
      loadingText,
      className,
      disabled,
      variant,
      children,
      ...props
    }: ButtonProps,
    forwardedRef,
  ) => {
    const Component = asChild ? Slot : "button"
    return (
      <Component
        ref={forwardedRef}
        className={cx(buttonVariants({ variant }), className)}
        disabled={disabled || isLoading}
        tremor-id="tremor-raw"
        {...props}
      >
        {isLoading ? (
          <span className="pointer-events-none flex shrink-0 items-center justify-center gap-1.5">
            <RiLoader2Fill
              className="size-4 shrink-0 animate-spin"
              aria-hidden="true"
            />
            <span className="sr-only">
              {loadingText ? loadingText : "Loading"}
            </span>
            {loadingText ? loadingText : children}
          </span>
        ) : (
          children
        )}
      </Component>
    )
  },
)

Button.displayName = "Button"

export { Button, buttonVariants, type ButtonProps }
